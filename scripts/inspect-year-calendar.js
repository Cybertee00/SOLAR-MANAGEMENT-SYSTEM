// Inspect Year Calendar Excel structure
const fs = require('fs');
const path = require('path');

let ExcelJS;
try {
  ExcelJS = require('../server/node_modules/exceljs');
} catch (e) {
  ExcelJS = require('exceljs');
}

function getCellValue(cell, worksheet) {
  if (!cell) return '';
  if (worksheet.model && worksheet.model.merges) {
    for (const merge of worksheet.model.merges) {
      if (cell.address === merge.topLeft || 
          (cell.row >= merge.top && cell.row <= merge.bottom &&
           cell.col >= merge.left && cell.col <= merge.right)) {
        return extractValue(worksheet.getCell(merge.top, merge.left));
      }
    }
  }
  return extractValue(cell);
}

function extractValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if (cell.value.richText) return cell.value.richText.map(rt => rt.text).join('');
    if (cell.value.text) return cell.value.text;
    if (cell.value.formula) return `=${cell.value.formula}`;
  }
  return String(cell.value).trim();
}

async function inspectCalendar() {
  const filePath = path.join(__dirname, '../server/templates/Year Calendar.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log('='.repeat(100));
  console.log('YEAR CALENDAR STRUCTURE ANALYSIS');
  console.log('='.repeat(100));
  console.log(`\nTotal Sheets: ${workbook.worksheets.length}\n`);
  
  workbook.worksheets.forEach((sheet, index) => {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`Sheet ${index + 1}: "${sheet.name}"`);
    console.log(`Dimensions: ${sheet.rowCount} rows × ${sheet.columnCount} columns`);
    console.log('='.repeat(100));
    
    // Show first 30 rows
    console.log('\nFirst 30 rows:');
    for (let rowNum = 1; rowNum <= Math.min(30, sheet.rowCount); rowNum++) {
      const row = sheet.getRow(rowNum);
      const rowData = [];
      let hasData = false;
      
      for (let colNum = 1; colNum <= Math.min(15, sheet.columnCount); colNum++) {
        const cell = row.getCell(colNum);
        const value = getCellValue(cell, sheet);
        rowData.push(value);
        if (value && value.trim()) hasData = true;
      }
      
      if (hasData) {
        console.log(`Row ${rowNum.toString().padStart(3, ' ')}:`, rowData.slice(0, 10).join(' | '));
        if (rowData.length > 10) {
          console.log('      ...', rowData.slice(10, 15).join(' | '));
        }
      }
    }
  });
}

inspectCalendar().catch(console.error);
