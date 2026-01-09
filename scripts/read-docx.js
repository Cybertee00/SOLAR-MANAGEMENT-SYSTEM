// Script to read and extract text from .docx file
const fs = require('fs');
const path = require('path');

// Try to use mammoth if available, otherwise provide instructions
let mammoth;
try {
  mammoth = require('mammoth');
} catch (e) {
  console.log('Installing mammoth to read .docx files...');
  console.log('Please run: npm install mammoth --save-dev');
  console.log('\nOr manually read the .docx file and provide its structure.');
  process.exit(1);
}

async function readDocx() {
  const docxPath = path.join(__dirname, '../Checksheets/WEATHER STATION.docx');
  
  if (!fs.existsSync(docxPath)) {
    console.error('File not found:', docxPath);
    process.exit(1);
  }

  try {
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value;
    
    console.log('='.repeat(60));
    console.log('WEATHER STATION CHECKLIST CONTENT:');
    console.log('='.repeat(60));
    console.log(text);
    console.log('='.repeat(60));
    
    // Save to a text file for reference
    const outputPath = path.join(__dirname, '../Checksheets/WEATHER STATION.txt');
    fs.writeFileSync(outputPath, text, 'utf8');
    console.log('\nContent saved to:', outputPath);
    
  } catch (error) {
    console.error('Error reading .docx file:', error);
    process.exit(1);
  }
}

readDocx();

