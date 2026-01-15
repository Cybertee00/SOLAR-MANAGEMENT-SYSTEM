// Debug Ventilation structure
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

async function debug() {
  const filePath = path.join(__dirname, '../server/templates/excel/Ventilation_Checklist.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const sheet = workbook.worksheets[0];
  
  console.log('Ventilation - Rows 11-25:');
  for (let rowNum = 11; rowNum <= 25; rowNum++) {
    const row = sheet.getRow(rowNum);
    console.log(`\nRow ${rowNum}:`);
    for (let colNum = 1; colNum <= 5; colNum++) {
      const value = getCellValue(row.getCell(colNum), sheet);
      if (value) {
        console.log(`  Col ${colNum}: "${value}"`);
      }
    }
  }
}

debug().catch(console.error);
