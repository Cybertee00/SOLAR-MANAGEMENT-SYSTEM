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

async function debugPM006() {
  const filePath = path.join(__dirname, '../templates/excel/Inverters.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  console.log('Header Row Detection:\n');
  
  // Test findHeaderRow logic
  for (let r = 1; r <= 20; r++) {
    const row = worksheet.getRow(r);
    let hasHeader = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text.includes('#') || text.includes('no') || text.includes('number') || 
          text.includes('item') || text.includes('description') || text.includes('check') ||
          text.includes('pass') || text.includes('fail')) {
        hasHeader = true;
      }
    });
    
    if (hasHeader) {
      console.log(`Row ${r} detected as header:`);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = getCellText(cell.value);
        console.log(`  Col ${colNumber}: "${text}"`);
      });
      console.log('');
    }
  }
  
  // Show rows 10-20
  console.log('\nRows 10-20:\n');
  for (let r = 10; r <= 20; r++) {
    const row = worksheet.getRow(r);
    const rowData = [];
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (text) {
        rowData.push(`C${c}:"${text.substring(0, 25)}"`);
      }
    }
    if (rowData.length > 0) {
      console.log(`Row ${r}: ${rowData.join(' | ')}`);
    }
  }
  
  // Check for {value}
  console.log('\n\nChecking for {value} in rows 10-20:\n');
  for (let r = 10; r <= 20; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (text.includes('{value}') || text.includes('{Value}')) {
        console.log(`Row ${r}, Col ${c}: "${text}"`);
      }
    }
  }
}

debugPM006().catch(console.error);
