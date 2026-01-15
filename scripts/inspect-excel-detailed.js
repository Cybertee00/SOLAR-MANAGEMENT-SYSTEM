// Detailed Excel inspection tool - shows actual structure of Excel files
// Helps understand how to properly parse the templates

const fs = require('fs');
const path = require('path');

// Try to load ExcelJS
let ExcelJS;
try {
  ExcelJS = require('../server/node_modules/exceljs');
} catch (e) {
  try {
    ExcelJS = require('exceljs');
  } catch (e2) {
    console.error('ExcelJS not found. Please install it: cd server && npm install exceljs');
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
    if (cell.value.richText) {
      return cell.value.richText.map(rt => rt.text).join('');
    } else if (cell.value.text) {
      return cell.value.text;
    } else if (cell.value.formula) {
      return `=${cell.value.formula}`;
    }
  }
  
  return String(cell.value).trim();
}

async function inspectExcelFile(filePath, maxRows = 50) {
  const fileName = path.basename(filePath);
  console.log('\n' + '='.repeat(100));
  console.log(`DETAILED INSPECTION: ${fileName}`);
  console.log('='.repeat(100));
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log(`\nTotal Sheets: ${workbook.worksheets.length}\n`);
  
  // Inspect first sheet in detail
  const firstSheet = workbook.worksheets[0];
  console.log(`Sheet: "${firstSheet.name}"`);
  console.log(`Dimensions: ${firstSheet.rowCount} rows × ${firstSheet.columnCount} columns\n`);
  
  // Show first maxRows rows with all columns
  console.log('='.repeat(100));
  console.log('ROW-BY-ROW INSPECTION (First 50 rows)');
  console.log('='.repeat(100));
  
  const maxCols = Math.min(25, firstSheet.columnCount);
  
  for (let rowNum = 1; rowNum <= Math.min(maxRows, firstSheet.rowCount); rowNum++) {
    const row = firstSheet.getRow(rowNum);
    const rowData = [];
    let hasData = false;
    
    for (let colNum = 1; colNum <= maxCols; colNum++) {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell, firstSheet);
      rowData.push(value);
      if (value && value.trim()) hasData = true;
    }
    
    // Only show rows with data
    if (hasData) {
      console.log(`\nRow ${rowNum.toString().padStart(3, ' ')}:`, rowData.slice(0, 10).join(' | '));
      if (rowData.length > 10) {
        console.log('      ...', rowData.slice(10, 15).join(' | '));
      }
    }
  }
  
  // Analyze structure
  console.log('\n' + '='.repeat(100));
  console.log('STRUCTURE ANALYSIS');
  console.log('='.repeat(100));
  
  // Find potential header rows
  console.log('\nPotential Header Rows:');
  for (let rowNum = 1; rowNum <= 20; rowNum++) {
    const row = firstSheet.getRow(rowNum);
    const rowValues = [];
    
    for (let colNum = 1; colNum <= maxCols; colNum++) {
      rowValues.push(getCellValue(row.getCell(colNum), firstSheet));
    }
    
    const rowText = rowValues.join(' ').toUpperCase();
    const hasCT = rowText.match(/CT\d+/);
    const hasInverter = rowText.match(/C\d{3}/) && !rowText.match(/CT/);
    const hasItem = rowText.includes('ITEM') || rowText.includes('NO');
    const hasDesc = rowText.includes('DESCRIPTION') || rowText.includes('CHECK');
    
    if (hasCT || hasInverter || (hasItem && hasDesc)) {
      console.log(`  Row ${rowNum}: ${rowValues.slice(0, 8).join(' | ')}`);
      if (hasCT) console.log(`    → Contains CT numbers`);
      if (hasInverter) console.log(`    → Contains inverter codes`);
      if (hasItem) console.log(`    → Contains "Item" or "No"`);
      if (hasDesc) console.log(`    → Contains "Description" or "Check"`);
    }
  }
  
  // Find data rows (rows with item numbers and descriptions)
  console.log('\nPotential Data Rows (first 20):');
  let dataRowCount = 0;
  for (let rowNum = 10; rowNum <= Math.min(30, firstSheet.rowCount) && dataRowCount < 20; rowNum++) {
    const row = firstSheet.getRow(rowNum);
    
    // Check first few columns for item numbers and descriptions
    const col1 = getCellValue(row.getCell(1), firstSheet);
    const col2 = getCellValue(row.getCell(2), firstSheet);
    const col3 = getCellValue(row.getCell(3), firstSheet);
    
    // Data row criteria: has item number pattern and description
    const hasItemNum = col1.match(/^\d+[\.\)]?\s*$/) || col2.match(/^\d+[\.\)]?\s*$/);
    const hasDescription = (col2 && col2.length > 10) || (col3 && col3.length > 10);
    
    if (hasItemNum && hasDescription) {
      dataRowCount++;
      console.log(`  Row ${rowNum}: [${col1}] ${col2.substring(0, 60)}${col2.length > 60 ? '...' : ''}`);
    }
  }
}

async function inspectAllServerTemplates() {
  const templatesDir = path.join(__dirname, '../server/templates/excel');
  
  const excelFiles = [
    'Concentrated Cabinet_Checklist.xlsx',
    'Energy Meter_Checklist.xlsx',
    'Ventilation_Checklist.xlsx'
  ];
  
  console.log('='.repeat(100));
  console.log('DETAILED EXCEL TEMPLATE INSPECTION');
  console.log('='.repeat(100));
  console.log('\nInspecting Excel files in server/templates/excel...\n');
  
  for (const fileName of excelFiles) {
    const filePath = path.join(templatesDir, fileName);
    if (fs.existsSync(filePath)) {
      await inspectExcelFile(filePath);
    } else {
      console.log(`\n⚠️  File not found: ${fileName}`);
    }
  }
}

if (require.main === module) {
  inspectAllServerTemplates()
    .then(() => {
      console.log('\n✓ Inspection complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Inspection failed:', error);
      process.exit(1);
    });
}

module.exports = { inspectExcelFile, inspectAllServerTemplates };
