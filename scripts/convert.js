const convertapi = require('convertapi')(process.env.CONVERTAPI_SECRET);
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '../input');
const outputDir = path.join(__dirname, '../output');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function convertPdfFiles() {
    try {
        const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.pdf'));

        if (files.length === 0) {
            console.log("No PDF files found in the 'input/' directory.");
            return;
        }

        for (const file of files) {
            const inputPath = path.join(inputDir, file);
            const outputPath = path.join(outputDir, file.replace('.pdf', '.docx'));
            
            console.log(`Converting ${file} to editable Word format...`);

            // Highly accurate layout reconstruction config for graphical elements
            const result = await convertapi.convert('docx', {
                File: inputPath,
                Layout: 'flowing',     // Keeps elements natural and continuous rather than boxed
                OcrMode: 'auto',       // Performs OCR only if text layers are embedded flat
                Annotations: 'textBox' // Separates structural labels into editable text frames
            }, 'pdf');

            // Save the resulting editable docx file
            await result.saveFiles(outputPath);
            console.log(`Successfully generated: ${outputPath}`);
        }
    } catch (error) {
        console.error("Conversion failed:", error);
        process.exit(1);
    }
}

convertPdfFiles();
