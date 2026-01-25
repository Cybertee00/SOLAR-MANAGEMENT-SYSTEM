require('dotenv').config();
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from Excel cell value
 */
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

/**
 * Analyze PM-006 (Inverters) Excel file
 */
async function analyzePM006() {
  const filePath = path.join(__dirname, '../templates/excel/Inverters.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  console.log('='.repeat(100));
  console.log('📊 ANALYZING PM-006 (Inverters)');
  console.log('='.repeat(100));
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  console.log(`\nWorksheet: "${worksheet.name}"`);
  console.log(`Dimensions: ${worksheet.rowCount} rows x ${worksheet.columnCount} columns\n`);
  
  // Find header row
  let headerRow = null;
  for (let r = 1; r <= 20; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value).toLowerCase();
      if (text.includes('item') || text.includes('description') || text.includes('pass') || text.includes('fail')) {
        headerRow = r;
        break;
      }
    }
    if (headerRow) break;
  }
  
  console.log(`Header Row: ${headerRow || 'Not found'}\n`);
  
  if (headerRow) {
    const headerRowData = worksheet.getRow(headerRow);
    console.log('Header Row Content:');
    headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(cell.value);
      console.log(`  Column ${colNumber}: "${text}"`);
    });
    console.log('');
  }
  
  // Scan for {value} placeholders
  console.log('🔍 Scanning for {value} placeholders:\n');
  const valueCells = [];
  
  for (let r = 1; r <= Math.min(worksheet.rowCount, 100); r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (text.includes('{value}') || text.includes('{Value}') || text.includes('{VALUE}')) {
        valueCells.push({
          row: r,
          col: c,
          text: text,
          cellRef: `${String.fromCharCode(64 + c)}${r}`
        });
      }
    }
  }
  
  if (valueCells.length > 0) {
    console.log(`Found ${valueCells.length} cells with {value}:\n`);
    valueCells.forEach(vc => {
      console.log(`  ${vc.cellRef}: "${vc.text}"`);
      
      // Get context (row content)
      const row = worksheet.getRow(vc.row);
      console.log(`    Row ${vc.row} context:`);
      for (let c = 1; c <= Math.min(10, worksheet.columnCount); c++) {
        const cell = row.getCell(c);
        const text = getCellText(cell.value);
        if (text) {
          console.log(`      Col ${c}: "${text.substring(0, 60)}"`);
        }
      }
      console.log('');
    });
  } else {
    console.log('No {value} placeholders found in first 100 rows\n');
  }
  
  // Show sample rows (rows 10-30)
  console.log('\n📋 Sample Rows (10-30):\n');
  for (let r = 10; r <= Math.min(30, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const rowData = [];
    for (let c = 1; c <= Math.min(8, worksheet.columnCount); c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      rowData.push(text.substring(0, 40));
    }
    if (rowData.some(c => c)) {
      console.log(`Row ${r}: ${rowData.join(' | ')}`);
    }
  }
}

/**
 * Analyze PM-021 (Substation BTU/Batteries) Excel file
 */
async function analyzePM021() {
  const filePath = path.join(__dirname, '../templates/excel/SUBSTATION-BATTERIES.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 ANALYZING PM-021 (Substation BTU/Batteries)');
  console.log('='.repeat(100));
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  console.log(`\nWorksheet: "${worksheet.name}"`);
  console.log(`Dimensions: ${worksheet.rowCount} rows x ${worksheet.columnCount} columns\n`);
  
  // Find header row
  let headerRow = null;
  for (let r = 1; r <= 20; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value).toLowerCase();
      if (text.includes('battery') || text.includes('cell') || text.includes('value') || text.includes('no.')) {
        headerRow = r;
        break;
      }
    }
    if (headerRow) break;
  }
  
  console.log(`Header Row: ${headerRow || 'Not found'}\n`);
  
  if (headerRow) {
    const headerRowData = worksheet.getRow(headerRow);
    console.log('Header Row Content:');
    headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(cell.value);
      console.log(`  Column ${colNumber}: "${text}"`);
    });
    console.log('');
  }
  
  // Scan for {value} placeholders
  console.log('🔍 Scanning for {value} placeholders:\n');
  const valueCells = [];
  
  for (let r = 1; r <= Math.min(worksheet.rowCount, 200); r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cell = row.getCell(c);
      const text = getCellText(cell.value);
      if (text.includes('{value}') || text.includes('{Value}') || text.includes('{VALUE}')) {
        valueCells.push({
          row: r,
          col: c,
          text: text,
          cellRef: `${String.fromCharCode(64 + c)}${r}`
        });
      }
    }
  }
  
  if (valueCells.length > 0) {
    console.log(`Found ${valueCells.length} cells with {value}:\n`);
    
    // Group by row to see patterns
    const byRow = {};
    valueCells.forEach(vc => {
      if (!byRow[vc.row]) byRow[vc.row] = [];
      byRow[vc.row].push(vc);
    });
    
    // Show first 10 rows with {value}
    const sampleRows = Object.keys(byRow).slice(0, 10).map(Number).sort((a, b) => a - b);
    sampleRows.forEach(rowNum => {
      const cells = byRow[rowNum];
      console.log(`Row ${rowNum}:`);
      cells.forEach(vc => {
        console.log(`  ${vc.cellRef}: "${vc.text}"`);
      });
      
      // Get full row context
      const row = worksheet.getRow(rowNum);
      const rowData = [];
      for (let c = 1; c <= Math.min(15, worksheet.columnCount); c++) {
        const cell = row.getCell(c);
        const text = getCellText(cell.value);
        if (text) {
          rowData.push(`Col${c}:"${text.substring(0, 30)}"`);
        }
      }
      if (rowData.length > 0) {
        console.log(`    Context: ${rowData.join(' | ')}`);
      }
      console.log('');
    });
    
    console.log(`\n... and ${valueCells.length - sampleRows.length} more cells with {value}\n`);
  } else {
    console.log('No {value} placeholders found\n');
  }
  
  // Look for "Battery Bank" sections
  console.log('\n🔍 Scanning for "Battery Bank" sections:\n');
  for (let r = 1; r <= Math.min(50, worksheet.rowCount); r++) {
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
          for (let sc = 1; sc <= Math.min(10, worksheet.columnCount); sc++) {
            const scell = srow.getCell(sc);
            const stext = getCellText(scell.value);
            if (stext) {
              rowData.push(stext.substring(0, 25));
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

async function analyzeBoth() {
  await analyzePM006();
  await analyzePM021();
  
  console.log('\n' + '='.repeat(100));
  console.log('✅ Analysis Complete');
  console.log('='.repeat(100));
}

if (require.main === module) {
  analyzeBoth().catch(console.error);
}

module.exports = { analyzePM006, analyzePM021 };
