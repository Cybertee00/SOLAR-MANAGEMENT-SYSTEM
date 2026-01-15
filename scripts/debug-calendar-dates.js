// Debug calendar date structure
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
    if (cell.value instanceof Date) return cell.value;
  }
  return String(cell.value).trim();
}

async function debugDates() {
  const filePath = path.join(__dirname, '../server/templates/Year Calendar.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const calendarSheet = workbook.worksheets.find(sheet => 
    sheet.name.includes('Jan-Dec') || sheet.name.includes('Calendar') || sheet.name.match(/\d{4}/)
  ) || workbook.worksheets[1];
  
  console.log('Calendar Date Structure - Rows 1-25, Columns 1-10:\n');
  
  for (let rowNum = 1; rowNum <= 25; rowNum++) {
    const row = calendarSheet.getRow(rowNum);
    const rowData = [];
    let hasData = false;
    
    for (let colNum = 1; colNum <= 10; colNum++) {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell, calendarSheet);
      
      if (value) {
        if (value instanceof Date) {
          rowData.push(`[DATE:${value.toISOString().split('T')[0]}]`);
          hasData = true;
        } else {
          rowData.push(value.length > 20 ? value.substring(0, 20) + '...' : value);
          hasData = true;
        }
      } else {
        rowData.push('');
      }
    }
    
    if (hasData) {
      console.log(`Row ${rowNum.toString().padStart(3, ' ')}:`, rowData.join(' | '));
    }
  }
}

debugDates().catch(console.error);
