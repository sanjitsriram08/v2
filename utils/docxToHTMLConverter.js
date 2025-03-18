const fs = require('fs');
const mammoth = require('mammoth');
const {join, basename, resolve, extname} = require("node:path");

// Function to clear all files in a folder
function clearFolder(folderPath) {
    try {
        // Read all files in the folder
        const files = fs.readdirSync(folderPath);

        files.forEach(file => {
            const filePath = join(folderPath, file);

            // Check if it's a file and delete
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath); // Remove the file
            }
        });

        console.log(`All files in '${folderPath}' have been removed.`);
    } catch (err) {
        console.error(`Error clearing folder '${folderPath}':`, err);
    }
}

// Function to convert docx to HTML
async function convertDocxToHtml(inputPath, outputPath, title) {
    try {
        console.log('Step 1: Reading the .docx file...');
        // Read the .docx file
        const docxBuffer = fs.readFileSync(inputPath);
        console.log('Step 1 Complete: Successfully read the .docx file.');

        console.log('Step 2: Converting .docx content to HTML...');

        // Convert to HTML using mammoth
        const { value: htmlContent, messages } = await mammoth.convertToHtml({ buffer: docxBuffer });
        console.log('Step 2 Complete: Conversion to HTML successful.');

        // Log any messages/warnings from Mammoth
        if (messages.length > 0) {
            console.log('Mammoth.js Messages/Warnings:');
            messages.forEach((msg, idx) => console.log(`  ${idx + 1}: ${msg}`));
        }

        console.log('Step 3: Wrapping the HTML content in a full HTML template...');

        // Generate a complete HTML page
        const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f9;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 20px auto;
            background: #fff;
            padding: 20px 30px;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        h1, h2, h3 {
            color: #2c3e50;
            margin-bottom: 15px;
        }

        p, ul, ol {
            margin-bottom: 15px;
            color: #555;
            font-size: 1rem;
        }

        ul, ol {
            padding-left: 20px;
        }

        a {
            color: #3498db;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        img {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 20px auto;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            max-height: 400px; /* Limit image height */
            object-fit: contain; /* Ensure the image maintains its aspect ratio */
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        table th, table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }

        table th {
            background-color: #f4f4f9;
            font-weight: bold;
        }

        table tr:nth-child(even) {
            background-color: #f9f9f9;
        }

        blockquote {
            border-left: 5px solid #3498db;
            padding-left: 15px;
            margin: 20px 0;
            font-style: italic;
            color: #555;
            background: #f9f9f9;
        }

        code, pre {
            background-color: #f4f4f9;
            padding: 10px;
            font-family: 'Courier New', Courier, monospace;
            border-radius: 5px;
            display: block;
            margin: 15px 0;
        }

        footer {
            text-align: center;
            margin-top: 30px;
            font-size: 0.9em;
            color: #777;
        }

        /* Overflow handling for large content */
        .container > * {
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
    </div>
    <footer>
        <p>© 2024 NikoNiko. All rights reserved.</p>
    </footer>
</body>
</html>

`;
        console.log('Step 3 Complete: Full HTML page created.');

        console.log('Step 4: Writing the HTML to the output file...');

        // Write the HTML to a file
        fs.writeFileSync(outputPath, fullHtml, 'utf-8');
        console.log(`Step 4 Complete: HTML file successfully written to ${outputPath}`);
    } catch (error) {
        console.error('Error during processing:', error);
    }
}

// Function to process all .docx files in the directory
async function processAllDocxFiles(inputDir, outputDir) {

    // Call the function to clear the folder
    clearFolder(outputDir);

    try {
        const files = fs.readdirSync(inputDir);

        // Filter to only process .docx files
        const docxFiles = files.filter(file => extname(file).toLowerCase() === '.docx');
        if (docxFiles.length === 0) {
            console.log('No .docx files found in the directory.');
            return;
        }

        // Process each .docx file
        for (const file of docxFiles) {
            const inputPath = join(inputDir, file);
            const outputFileName = basename(file, '.docx') + '.html';
            const outputPath = join(outputDir, outputFileName);
            await convertDocxToHtml(inputPath, outputPath, basename(file, '.docx'));
        }

        console.log('Batch processing complete!');
    } catch (error) {
        console.error('Error during batch processing:', error);
    }
}
// Get the language parameter from the command-line arguments
const language = process.argv[2]; // e.g., 'en' or 'ja'

if (!['en', 'ja'].includes(language)) {
    console.error('Invalid language parameter. Please provide "en" or "ja".');
    process.exit(1);
}

// Input and output directory paths
const inputDir = join(__dirname, '../support_files', language, 'docx_files'); // Directory containing .docx files
const outputDir = join(__dirname, '../support_files', language, 'html_files'); // Output directory for .html files

(async () => {
    try {
        console.log('Starting batch conversion of .docx files...');
        await processAllDocxFiles(inputDir, outputDir);
        console.log('All files processed successfully.');
    } catch (err) {
        console.error('An error occurred:', err);
    }
})();