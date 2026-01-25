// Temporarily modify parser to add logging
const fs = require('fs');
const path = require('path');

// Read the parser file
const parserPath = path.join(__dirname, '../utils/templateParser.js');
let parserCode = fs.readFileSync(parserPath, 'utf8');

// Add logging after section creation
parserCode = parserCode.replace(
  /currentSection = \{[\s\S]*?items: \[\]\s*\};/g,
  (match) => {
    return match + '\n      console.log("Created section:", currentSection.id, currentSection.title);';
  }
);

// Add logging when items are added
parserCode = parserCode.replace(
  /currentSection\.items\.push\(item\);/g,
  'console.log("Added item:", item.label, "type:", item.type, "measurement_fields:", item.measurement_fields?.length || 0);\n      currentSection.items.push(item);'
);

// Write temporary parser
const tempParserPath = path.join(__dirname, '../utils/templateParser.temp.js');
fs.writeFileSync(tempParserPath, parserCode);

// Now test
const { parseExcelFile } = require('../utils/templateParser.temp');

async function test() {
  const filePath = path.join(__dirname, '../templates/excel/Inverters.xlsx');
  const result = await parseExcelFile(filePath, 'inverter', 'INV', 'Inverters.xlsx');
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  // Cleanup
  fs.unlinkSync(tempParserPath);
}

test().catch(console.error);
