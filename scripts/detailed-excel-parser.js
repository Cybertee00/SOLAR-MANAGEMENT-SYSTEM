// Detailed Excel parser to extract checklist structure
// Focuses on Concentrated Cabinet and Inverter templates

const fs = require('fs');
const path = require('path');

// Try to load ExcelJS from server/node_modules first, then root
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

async function parseConcentratedCabinet(filePath) {
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED ANALYSIS: Concentrated Cabinet Checklist');
  console.log('='.repeat(80));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const structure = {
    templateName: 'Concentrated Cabinet Checklist',
    procedure: null,
    sheets: []
  };

  // Analyze first sheet in detail
  const firstSheet = workbook.worksheets[0];
  console.log(`\nAnalyzing Sheet: "${firstSheet.name}"\n`);

  // Extract procedure number and title
  for (let rowNum = 1; rowNum <= 10; rowNum++) {
    const row = firstSheet.getRow(rowNum);
    const rowText = row.values.join(' ').toUpperCase();
    
    if (rowText.includes('PROCEDURE') || rowText.includes('PM-')) {
      const procedureCell = row.getCell(1);
      if (procedureCell.value) {
        structure.procedure = String(procedureCell.value);
        console.log(`Procedure: ${structure.procedure}`);
      }
    }
    
    if (rowText.includes('TITLE:')) {
      const titleCell = row.getCell(2);
      if (titleCell.value) {
        structure.title = String(titleCell.value);
        console.log(`Title: ${structure.title}`);
      }
    }
  }

  // Find header row (usually contains "Item", "Description", "CT1", "CT2", etc.)
  let headerRow = null;
  let dataStartRow = null;

  for (let rowNum = 1; rowNum <= 30; rowNum++) {
    const row = firstSheet.getRow(rowNum);
    const rowValues = [];
    
    for (let colNum = 1; colNum <= firstSheet.columnCount; colNum++) {
      const cell = row.getCell(colNum);
      let value = cell.value;
      if (value === null || value === undefined) value = '';
      else if (typeof value === 'object' && value.richText) {
        value = value.richText.map(rt => rt.text).join('');
      } else {
        value = String(value);
      }
      rowValues.push(value);
    }

    const rowText = rowValues.join(' ').toUpperCase();
    
    // Look for header row with CT numbers
    if (rowText.includes('ITEM') && (rowText.includes('CT1') || rowText.includes('CT01') || rowText.match(/CT\d+/))) {
      headerRow = rowNum;
      dataStartRow = rowNum + 1;
      console.log(`\nHeader row found at row ${rowNum}`);
      console.log(`Data starts at row ${dataStartRow}`);
      
      // Extract CT numbers from header
      const ctNumbers = [];
      rowValues.forEach((val, idx) => {
        const match = String(val).match(/CT(\d+)/i);
        if (match) {
          ctNumbers.push({
            column: idx + 1,
            ctNumber: `CT${match[1]}`,
            displayName: val
          });
        }
      });
      
      console.log(`\nCT Numbers found in columns:`);
      ctNumbers.forEach(ct => {
        console.log(`  Column ${ct.column}: ${ct.ctNumber} (${ct.displayName})`);
      });
      
      structure.ctColumns = ctNumbers;
      break;
    }
  }

  // Extract checklist items
  if (dataStartRow) {
    const items = [];
    const maxRows = Math.min(dataStartRow + 100, firstSheet.rowCount);
    
    for (let rowNum = dataStartRow; rowNum <= maxRows; rowNum++) {
      const row = firstSheet.getRow(rowNum);
      const itemCell = row.getCell(1); // Usually first column has item number
      const descCell = row.getCell(2); // Usually second column has description
      
      let itemNum = itemCell.value ? String(itemCell.value).trim() : '';
      let description = descCell.value ? String(descCell.value).trim() : '';
      
      // Skip empty rows
      if (!itemNum && !description) continue;
      
      // Check if this is a section header (usually bold or merged)
      if (description && description.length > 0 && !itemNum.match(/^\d+$/)) {
        // Might be a section header
        items.push({
          type: 'section',
          row: rowNum,
          title: description,
          itemNumber: itemNum || null
        });
      } else if (itemNum.match(/^\d+/) && description) {
        // This is a checklist item
        items.push({
          type: 'item',
          row: rowNum,
          itemNumber: itemNum,
          description: description,
          ctValues: {}
        });
        
        // Extract values for each CT column
        if (structure.ctColumns) {
          structure.ctColumns.forEach(ct => {
            const ctCell = row.getCell(ct.column);
            let value = ctCell.value;
            if (value === null || value === undefined) value = '';
            else if (typeof value === 'object' && value.richText) {
              value = value.richText.map(rt => rt.text).join('');
            } else {
              value = String(value);
            }
            items[items.length - 1].ctValues[ct.ctNumber] = value.trim();
          });
        }
      }
    }
    
    console.log(`\nExtracted ${items.length} items/sections`);
    console.log(`\nSample items (first 10):`);
    items.slice(0, 10).forEach(item => {
      if (item.type === 'section') {
        console.log(`  [SECTION] ${item.title}`);
      } else {
        console.log(`  [ITEM ${item.itemNumber}] ${item.description.substring(0, 60)}...`);
      }
    });
    
    structure.items = items;
  }

  // Analyze all sheets
  workbook.worksheets.forEach((sheet, idx) => {
    structure.sheets.push({
      name: sheet.name,
      index: idx + 1,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount
    });
  });

  return structure;
}

async function parseInverterTemplate(filePath) {
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED ANALYSIS: Monthly Inspection for CT Building Inverters');
  console.log('='.repeat(80));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const structure = {
    templateName: 'Monthly Inspection for CT Building Inverters',
    procedure: 'PM-006',
    sheets: []
  };

  // Analyze first sheet
  const firstSheet = workbook.worksheets[0];
  console.log(`\nAnalyzing Sheet: "${firstSheet.name}"\n`);

  // Find header row with CT and Inverter codes
  let headerRow = null;
  let dataStartRow = null;
  const inverterColumns = [];

  for (let rowNum = 1; rowNum <= 30; rowNum++) {
    const row = firstSheet.getRow(rowNum);
    const rowValues = [];
    
    for (let colNum = 1; colNum <= firstSheet.columnCount; colNum++) {
      const cell = row.getCell(colNum);
      let value = cell.value;
      if (value === null || value === undefined) value = '';
      else if (typeof value === 'object' && value.richText) {
        value = value.richText.map(rt => rt.text).join('');
      } else {
        value = String(value);
      }
      rowValues.push(value);
    }

    const rowText = rowValues.join(' ').toUpperCase();
    
    // Look for header with CT and C001, C002, etc.
    if (rowText.includes('ITEM') && (rowText.includes('C001') || rowText.includes('C002') || rowText.match(/C\d{3}/))) {
      headerRow = rowNum;
      dataStartRow = rowNum + 1;
      console.log(`\nHeader row found at row ${rowNum}`);
      
      // Extract CT and Inverter codes
      rowValues.forEach((val, idx) => {
        const ctMatch = String(val).match(/CT(\d+)/i);
        const invMatch = String(val).match(/C(\d{3})/i);
        
        if (ctMatch) {
          inverterColumns.push({
            column: idx + 1,
            type: 'ct',
            code: `CT${ctMatch[1]}`,
            displayName: val
          });
        } else if (invMatch) {
          inverterColumns.push({
            column: idx + 1,
            type: 'inverter',
            code: `C${invMatch[1]}`,
            displayName: val,
            inverterNumber: parseInt(invMatch[1])
          });
        }
      });
      
      console.log(`\nCT Buildings and Inverters found:`);
      inverterColumns.forEach(col => {
        if (col.type === 'ct') {
          console.log(`  [CT Building] Column ${col.column}: ${col.code}`);
        } else {
          console.log(`  [Inverter] Column ${col.column}: ${col.code} (Inverter ${col.inverterNumber})`);
        }
      });
      
      break;
    }
  }

  structure.inverterColumns = inverterColumns;

  // Analyze all sheets
  workbook.worksheets.forEach((sheet, idx) => {
    structure.sheets.push({
      name: sheet.name,
      index: idx + 1
    });
  });

  return structure;
}

async function main() {
  const checksheetsDir = path.join(__dirname, '../Checksheets');
  
  // Parse Concentrated Cabinet
  const cabinetFile = path.join(checksheetsDir, 'CT Concentrated Cabinet_Checklist 202503.xlsx');
  const cabinetStructure = await parseConcentratedCabinet(cabinetFile);
  
  // Parse Inverter template
  const inverterFile = path.join(checksheetsDir, 'Monthly Inspection for CT 1 building Inverters (PM_06) 202505.xlsx');
  const inverterStructure = await parseInverterTemplate(inverterFile);
  
  // Save results
  const output = {
    concentratedCabinet: cabinetStructure,
    inverterInspection: inverterStructure,
    analysisDate: new Date().toISOString()
  };
  
  const outputPath = path.join(__dirname, '../excel-detailed-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n\nDetailed analysis saved to: ${outputPath}`);
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('\nConcentrated Cabinet Checklist:');
  console.log(`  - Procedure: ${cabinetStructure.procedure || 'Not found'}`);
  console.log(`  - Sheets: ${cabinetStructure.sheets.length}`);
  console.log(`  - CT Buildings per sheet: ${cabinetStructure.ctColumns ? cabinetStructure.ctColumns.length : 'Unknown'}`);
  console.log(`  - Checklist items extracted: ${cabinetStructure.items ? cabinetStructure.items.length : 0}`);
  
  console.log('\nInverter Inspection:');
  console.log(`  - Procedure: ${inverterStructure.procedure}`);
  console.log(`  - Sheets: ${inverterStructure.sheets.length}`);
  console.log(`  - CT Buildings and Inverters: ${inverterStructure.inverterColumns ? inverterStructure.inverterColumns.length : 'Unknown'}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { parseConcentratedCabinet, parseInverterTemplate };
