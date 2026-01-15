// Script to analyze Excel checklist templates
// Analyzes structure, sheets, and data patterns

try {
  require('dotenv').config();
} catch (e) {
  // dotenv not required for this script
}

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
const fs = require('fs');
const path = require('path');

async function analyzeExcelFile(filePath) {
  console.log('\n' + '='.repeat(80));
  console.log(`Analyzing: ${path.basename(filePath)}`);
  console.log('='.repeat(80));

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
    
    const analysis = {
      fileName: path.basename(filePath),
      filePath: filePath,
      sheetCount: workbook.worksheets.length,
      sheets: []
    };

    console.log(`\nTotal Sheets: ${workbook.worksheets.length}\n`);

    // Analyze each sheet
    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      console.log(`\n--- Sheet ${sheetIndex + 1}: "${worksheet.name}" ---`);
      console.log(`Dimensions: ${worksheet.rowCount} rows × ${worksheet.columnCount} columns`);

      const sheetAnalysis = {
        name: worksheet.name,
        index: sheetIndex + 1,
        rowCount: worksheet.rowCount,
        columnCount: worksheet.columnCount,
        hasData: worksheet.rowCount > 0,
        headers: [],
        sampleRows: [],
        patterns: {
          hasCTNumbers: false,
          hasInverterCodes: false,
          hasChecklistItems: false,
          hasPassFail: false
        },
        structure: {}
      };

      // Analyze first few rows for headers and structure
      const maxRowsToAnalyze = Math.min(20, worksheet.rowCount);
      const maxColsToAnalyze = Math.min(15, worksheet.columnCount);

      for (let rowNum = 1; rowNum <= maxRowsToAnalyze; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData = [];

        for (let colNum = 1; colNum <= maxColsToAnalyze; colNum++) {
          const cell = row.getCell(colNum);
          let cellValue = cell.value;

          // Handle different cell value types
          if (cellValue === null || cellValue === undefined) {
            cellValue = '';
          } else if (typeof cellValue === 'object') {
            if (cellValue.richText) {
              cellValue = cellValue.richText.map(rt => rt.text).join('');
            } else if (cellValue.text) {
              cellValue = cellValue.text;
            } else if (cellValue.formula) {
              cellValue = `=${cellValue.formula}`;
            } else {
              cellValue = String(cellValue);
            }
          } else {
            cellValue = String(cellValue);
          }

          rowData.push(cellValue);
        }

        // Detect patterns
        const rowText = rowData.join(' ').toUpperCase();
        
        if (rowNum === 1 || rowNum <= 5) {
          // Check for headers
          if (rowText.includes('CT') || rowText.match(/CT\d+/)) {
            sheetAnalysis.patterns.hasCTNumbers = true;
          }
          if (rowText.includes('C001') || rowText.includes('C002') || rowText.includes('INVERTER')) {
            sheetAnalysis.patterns.hasInverterCodes = true;
          }
          if (rowText.includes('CHECK') || rowText.includes('INSPECT') || rowText.includes('VERIFY')) {
            sheetAnalysis.patterns.hasChecklistItems = true;
          }
          if (rowText.includes('PASS') || rowText.includes('FAIL') || rowText.includes('OK') || rowText.includes('NOT OK')) {
            sheetAnalysis.patterns.hasPassFail = true;
          }
        }

        if (rowNum === 1) {
          sheetAnalysis.headers = rowData.filter(v => v && v.trim() !== '');
        } else if (rowNum <= 10 && rowData.some(v => v && v.trim() !== '')) {
          sheetAnalysis.sampleRows.push({
            rowNumber: rowNum,
            data: rowData
          });
        }
      }

      // Analyze structure - look for merged cells, formatting, etc.
      if (worksheet.model && worksheet.model.merges) {
        sheetAnalysis.mergedCells = worksheet.model.merges.length;
        console.log(`  Merged cells: ${worksheet.model.merges.length}`);
      }

      // Print summary
      console.log(`  Headers found: ${sheetAnalysis.headers.length}`);
      console.log(`  Patterns detected:`);
      console.log(`    - CT Numbers: ${sheetAnalysis.patterns.hasCTNumbers ? 'Yes' : 'No'}`);
      console.log(`    - Inverter Codes: ${sheetAnalysis.patterns.hasInverterCodes ? 'Yes' : 'No'}`);
      console.log(`    - Checklist Items: ${sheetAnalysis.patterns.hasChecklistItems ? 'Yes' : 'No'}`);
      console.log(`    - Pass/Fail: ${sheetAnalysis.patterns.hasPassFail ? 'Yes' : 'No'}`);

      if (sheetAnalysis.headers.length > 0) {
        console.log(`  Headers: ${sheetAnalysis.headers.slice(0, 5).join(', ')}${sheetAnalysis.headers.length > 5 ? '...' : ''}`);
      }

      // Show sample data
      if (sheetAnalysis.sampleRows.length > 0) {
        console.log(`  Sample rows (first non-empty cells):`);
        sheetAnalysis.sampleRows.slice(0, 3).forEach(sample => {
          const nonEmpty = sample.data.filter(v => v && String(v).trim() !== '').slice(0, 5);
          if (nonEmpty.length > 0) {
            console.log(`    Row ${sample.rowNumber}: ${nonEmpty.join(' | ')}`);
          }
        });
      }

      analysis.sheets.push(sheetAnalysis);
    });

    return analysis;

  } catch (error) {
    console.error(`Error reading Excel file: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

async function analyzeAllTemplates() {
  const checksheetsDir = path.join(__dirname, '../Checksheets');
  const excelFiles = [
    'CT Concentrated Cabinet_Checklist 202503.xlsx',
    'CT Energy Meter_Checklist 202509.xlsx',
    'Annual Inspection for CT 1-24 Safety & Fire 202509.xlsx',
    'Monthly Inspection for CT 1 building Inverters (PM_06) 202505.xlsx',
    'PM 05 - Weekly SCADA Stings monitoring. 202509.xlsx',
    'CCTV PM.xlsx',
    'String Combiner box Inspection_Checklist 202403.xlsx',
    'SUBST01_BTU_PM-021-r00 - Monthly Inspection.xlsx',
    'Ventilation PM009_Checklist.xlsx',
    'CT MV_PM-008_ Check list.xlsx'
  ];

  console.log('='.repeat(80));
  console.log('EXCEL TEMPLATE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Analyzing ${excelFiles.length} Excel templates...\n`);

  const analyses = [];

  for (const fileName of excelFiles) {
    const filePath = path.join(checksheetsDir, fileName);
    const analysis = await analyzeExcelFile(filePath);
    if (analysis) {
      analyses.push(analysis);
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY REPORT');
  console.log('='.repeat(80));

  analyses.forEach(analysis => {
    console.log(`\n${analysis.fileName}:`);
    console.log(`  - ${analysis.sheetCount} sheet(s)`);
    analysis.sheets.forEach(sheet => {
      console.log(`    Sheet "${sheet.name}": ${sheet.rowCount} rows, ${sheet.columnCount} cols`);
      if (sheet.patterns.hasCTNumbers) {
        console.log(`      → Contains CT numbers (City Building/Inverter Building)`);
      }
      if (sheet.patterns.hasInverterCodes) {
        console.log(`      → Contains inverter codes (C001, C002, etc.)`);
      }
    });
  });

  // Save detailed analysis to JSON
  const outputPath = path.join(__dirname, '../excel-templates-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(analyses, null, 2), 'utf8');
  console.log(`\n\nDetailed analysis saved to: ${outputPath}`);

  return analyses;
}

// Run analysis
if (require.main === module) {
  analyzeAllTemplates()
    .then(() => {
      console.log('\nAnalysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeExcelFile, analyzeAllTemplates };
