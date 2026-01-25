require('dotenv').config();
const ExcelJS = require('exceljs');
const path = require('path');

function getCellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.richText && Array.isArray(value.richText)) {
      return value.richText.map(rt => rt.text || '').join('').trim();
    }
    if (value.formula) return `=${value.formula}`;
    if (value.result !== undefined) return String(value.result);
  }
  return String(value).trim();
}

async function debugParser() {
  const filePath = path.join(__dirname, '../templates/excel/Inverters.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  // Simulate parser logic
  let numberCol = 2;
  let descriptionCol = 3;
  let startRow = 13; // After header (11) and sub-header (12)
  
  console.log(`Number Col: ${numberCol}, Description Col: ${descriptionCol}, Start Row: ${startRow}\n`);
  
  let usesDecimalNumbering = false;
  for (let r = startRow; r < Math.min(startRow + 20, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const numberText = getCellText(numberCell.value).trim();
    if (/^\d+\.\d+/.test(numberText)) {
      usesDecimalNumbering = true;
      break;
    }
  }
  
  console.log(`Uses Decimal Numbering: ${usesDecimalNumbering}\n`);
  console.log('Parsing rows:\n');
  
  for (let r = startRow; r <= Math.min(worksheet.rowCount, startRow + 10); r++) {
    const row = worksheet.getRow(r);
    const numberCell = row.getCell(numberCol);
    const descriptionCell = row.getCell(descriptionCol);
    const numberText = getCellText(numberCell.value);
    const descriptionText = getCellText(descriptionCell.value);
    
    if (!numberText && !descriptionText) {
      console.log(`Row ${r}: EMPTY`);
      continue;
    }
    
    const trimmedNumber = numberText.trim();
    const trimmedDesc = descriptionText.trim();
    
    console.log(`Row ${r}:`);
    console.log(`  Number: "${trimmedNumber}"`);
    console.log(`  Description: "${trimmedDesc}"`);
    
    const isSectionNumber = /^\d+$/.test(trimmedNumber) && !usesDecimalNumbering;
    const isItemNumber = /^\d+\.\d+/.test(trimmedNumber);
    const isSequentialNumber = /^\d+$/.test(trimmedNumber) && usesDecimalNumbering;
    
    console.log(`  isSectionNumber: ${isSectionNumber}`);
    console.log(`  isItemNumber: ${isItemNumber}`);
    console.log(`  isSequentialNumber: ${isSequentialNumber}`);
    
    // Check for {value}
    const passFailStartCol = 10;
    const passFailEndCol = 11;
    const valuePlaceholders = [];
    for (let c = passFailStartCol; c <= passFailEndCol; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (/\{value\}|\{Value\}|\{VALUE\}/i.test(text)) {
        valuePlaceholders.push(c);
      }
    }
    
    if (valuePlaceholders.length > 0) {
      console.log(`  {value} found in columns: ${valuePlaceholders.join(', ')}`);
    }
    
    console.log('');
  }
}

debugParser().catch(console.error);
