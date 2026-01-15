/**
 * Analyze the Fault Log Excel template structure
 * This helps understand the columns and data format needed
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../CM letter/Fault log.xlsx');

async function analyzeFaultLog() {
  try {
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Fault log template not found:', templatePath);
      process.exit(1);
    }

    console.log('📊 Analyzing Fault Log template:', templatePath);
    console.log('');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    console.log(`📄 Workbook has ${workbook.worksheets.length} worksheet(s)\n`);

    workbook.worksheets.forEach((worksheet, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Worksheet ${index + 1}: "${worksheet.name}"`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Dimensions: ${worksheet.actualRowCount} rows × ${worksheet.actualColumnCount} columns\n`);

      // Find header row (usually row 1 or 2)
      let headerRow = null;
      let headerRowNum = 0;
      
      for (let rowNum = 1; rowNum <= Math.min(10, worksheet.actualRowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        const hasText = row.values.some(v => v && typeof v === 'string' && v.trim().length > 0);
        if (hasText) {
          const cellValues = row.values.filter(v => v !== null && v !== undefined);
          if (cellValues.length > 3) { // Likely a header row
            headerRow = row;
            headerRowNum = rowNum;
            break;
          }
        }
      }

      if (headerRow) {
        console.log(`📋 Header row found at row ${headerRowNum}:`);
        console.log('');
        const headers = [];
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const header = cell.value ? String(cell.value).trim() : '';
          if (header) {
            headers.push({ col: colNumber, letter: cell.address.replace(/\d+/, ''), header });
            console.log(`  Column ${colNumber} (${cell.address.replace(/\d+/, '')}): "${header}"`);
          }
        });
        console.log('');

        // Show sample data rows (next 5 rows after header)
        console.log('📝 Sample data rows:');
        for (let rowNum = headerRowNum + 1; rowNum <= Math.min(headerRowNum + 6, worksheet.actualRowCount); rowNum++) {
          const row = worksheet.getRow(rowNum);
          const rowData = {};
          headers.forEach(({ col, letter, header }) => {
            const cell = row.getCell(col);
            rowData[header] = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
          });
          
          // Only show row if it has some data
          if (Object.values(rowData).some(v => v.trim().length > 0)) {
            console.log(`\n  Row ${rowNum}:`);
            headers.forEach(({ header }) => {
              const value = rowData[header] || '(empty)';
              if (value.length > 50) {
                console.log(`    ${header}: ${value.substring(0, 50)}...`);
              } else {
                console.log(`    ${header}: ${value}`);
              }
            });
          }
        }
      } else {
        console.log('⚠️  No clear header row found. Showing first 10 rows:');
        for (let rowNum = 1; rowNum <= Math.min(10, worksheet.actualRowCount); rowNum++) {
          const row = worksheet.getRow(rowNum);
          const values = row.values.filter((v, i) => i > 0 && (v !== null && v !== undefined));
          if (values.length > 0) {
            console.log(`\n  Row ${rowNum}:`, values.map(v => String(v).substring(0, 30)).join(' | '));
          }
        }
      }

      // Check for merged cells
      if (worksheet.model && worksheet.model.merges && worksheet.model.merges.length > 0) {
        console.log(`\n🔗 Found ${worksheet.model.merges.length} merged cell(s)`);
      }

      // Check for formulas
      let formulaCount = 0;
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.formula) formulaCount++;
        });
      });
      if (formulaCount > 0) {
        console.log(`\n🧮 Found ${formulaCount} formula(s)`);
      }
    });

    console.log('\n✅ Analysis complete!\n');
  } catch (error) {
    console.error('❌ Error analyzing template:', error);
    process.exit(1);
  }
}

analyzeFaultLog();
