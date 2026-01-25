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

async function debugPM021() {
  const filePath = path.join(__dirname, '../templates/excel/SUBSTATION-BATTERIES.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  console.log('Checking header row detection:\n');
  
  // Test findHeaderRow logic
  for (let r = 1; r <= 20; r++) {
    const row = worksheet.getRow(r);
    let hasItem = false;
    let hasDescription = false;
    let hasPassFail = false;
    
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text === 'item' || (text.includes('item') && text.length < 10)) {
        hasItem = true;
      }
      if (text === 'description' || (text.includes('description') && text.length < 15)) {
        hasDescription = true;
      }
      if (text.includes('pass') && text.includes('fail')) {
        hasPassFail = true;
      }
    });
    
    if (hasItem && hasDescription) {
      console.log(`Row ${r} detected as header (hasItem: ${hasItem}, hasDescription: ${hasDescription})`);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = getCellText(cell.value);
        console.log(`  Col ${colNumber}: "${text}"`);
      });
      console.log('');
    }
  }
  
  // Check for Battery Bank
  console.log('\nChecking for Battery Bank sections:\n');
  for (let r = 1; r <= 20; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (text.toLowerCase().includes('battery bank')) {
        console.log(`Found "Battery Bank" at Row ${r}, Column ${c}: "${text}"`);
        
        // Show surrounding rows
        for (let sr = Math.max(1, r - 2); sr <= Math.min(worksheet.rowCount, r + 5); sr++) {
          const srow = worksheet.getRow(sr);
          const rowData = [];
          for (let sc = 1; sc <= Math.min(15, worksheet.columnCount); sc++) {
            const scell = srow.getCell(sc);
            const stext = getCellText(scell.value);
            if (stext) {
              rowData.push(`C${sc}:"${stext.substring(0, 20)}"`);
            }
          }
          if (rowData.length > 0) {
            console.log(`  Row ${sr}: ${rowData.join(' | ')}`);
          }
        }
        console.log('');
      }
    }
  }
}

debugPM021().catch(console.error);
