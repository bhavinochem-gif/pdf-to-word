const fs = require('fs');
const path = require('path');

const API_KEY = process.env.CONVERTIO_API_KEY;
const INPUT_DIR = path.join(__dirname, '../input');
const OUTPUT_DIR = path.join(__dirname, '../output');

// Utility to pause execution for status polling
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

if (!API_KEY) {
    console.error("Error: CONVERTIO_API_KEY environment variable is not defined.");
    process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function convertFile(fileName) {
    const inputPath = path.join(INPUT_DIR, fileName);
    const outputPath = path.join(OUTPUT_DIR, fileName.replace('.pdf', '.docx'));

    console.log(`\nProcessing file: ${fileName}`);

    try {
        // Step 1: Read the target PDF and encode it to Base64 to safely pass to the REST API
        const fileBuffer = fs.readFileSync(inputPath);
        const base64File = fileBuffer.toString('base64');

        console.log("-> Starting conversion request with Convertio...");
        const initResponse = await fetch('https://api.convertio.co/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apikey: API_KEY,
                input: 'base64',
                file: base64File,
                filename: fileName,
                outputformat: 'docx'
            })
        });

        const initData = await initResponse.json();

        if (initData.status !== 'ok') {
            throw new Error(`Convertio initialization failed: ${initData.error || JSON.stringify(initData)}`);
        }

        const conversionId = initData.data.id;
        console.log(`-> Job successfully queued. Conversion ID: ${conversionId}`);

        // Step 2: Poll Convertio servers until processing finishes
        let isCompleted = false;
        let downloadUrl = '';

        while (!isCompleted) {
            await delay(5000); // Wait 5 seconds between checks to respect rate limits
            
            const statusResponse = await fetch(`https://convertio.co{conversionId}/status`);
            const statusData = await statusResponse.json();

            if (statusData.status !== 'ok') {
                throw new Error(`Error checking job status: ${statusData.error}`);
            }

            const step = statusData.data.step;
            const progress = statusData.data.step_percent || 0;
            console.log(`   Current Step: ${step} (${progress}%)`);

            if (step === 'finish') {
                isCompleted = true;
                downloadUrl = statusData.data.output.url;
            } else if (step === 'error') {
                throw new Error(`Convertio engine failed processing: ${statusData.data.error || 'Unknown conversion error'}`);
            }
        }

        // Step 3: Fetch the generated Word document and commit it to disk
        console.log("-> Downloading converted DOCX file...");
        const docxResponse = await fetch(downloadUrl);
        if (!docxResponse.ok) throw new Error("Failed to download file from temporary Convertio storage.");

        const docxBuffer = await docxResponse.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(docxBuffer));
        console.log(`-> Saved: ${outputPath}`);

    } catch (error) {
        console.error(`✕ Error converting ${fileName}:`, error.message);
        throw error;
    }
}

async function startPipeline() {
    try {
        const files = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith('.pdf'));

        if (files.length === 0) {
            console.log("No PDF files found in the 'input/' folder.");
            return;
        }

        console.log(`Found ${files.length} file(s) ready for processing.`);
        for (const file of files) {
            await convertFile(file);
        }
        console.log("\nAll document processing has finished successfully.");
    } catch (error) {
        process.exit(1);
    }
}

startPipeline();
