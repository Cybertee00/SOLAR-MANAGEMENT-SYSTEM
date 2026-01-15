// Debug script to show exact structure of rows 13-20
const fs = require('fs');
const path = require('path');

let ExcelJS;
try {
  ExcelJS = require('../server/node_modules/exceljs');
} catch (e) {
  try {
    ExcelJS = require('exceljs');
  } catch (e2) {
    console.error('ExcelJS not found');
    process.exit(1);
  }
}

function getCellValue(cell, worksheet) {
  if (!cell) return '';
  if (worksheet.model && worksheet.model.merges) {
    for (const merge of worksheet.model.merges) {
      if (cell.address === merge.topLeft || 
          (cell.row >= merge.top && cell.row <= merge.bottom &&
           cell.col >= merge.left && cell.col <= merge.right)) {
        const topLeftCell = worksheet.getCell(merge.top, merge.left);
        return extractValue(topLeftCell);
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

async function debugRows() {
  const filePath = path.join(__dirname, '../server/templates/excel/Concentrated Cabinet_Checklist.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const sheet = workbook.worksheets[0]; // First sheet
  
  console.log('='.repeat(100));
  console.log('DEBUG: Rows 13-25 (Data Rows)');
  console.log('='.repeat(100));
  
  for (let rowNum = 13; rowNum <= 25; rowNum++) {
    const row = sheet.getRow(rowNum);
    console.log(`\nRow ${rowNum}:`);
    
    // Show first 10 columns
    for (let colNum = 1; colNum <= 10; colNum++) {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell, sheet);
      if (value) {
        console.log(`  Col ${colNum}: "${value}"`);
      }
    }
  }
}

debugRows().catch(console.error);
