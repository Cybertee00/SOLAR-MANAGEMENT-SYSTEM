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
 * Analyze a single Excel file to find template code and name
 */
async function analyzeExcelFile(filePath) {
  const fileName = path.basename(filePath);
  console.log('\n' + '='.repeat(100));
  console.log(`📄 Analyzing: ${fileName}`);
  console.log('='.repeat(100));
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.log('❌ No worksheet found');
      return null;
    }
    
    console.log(`\nWorksheet: "${worksheet.name}"`);
    console.log(`Dimensions: ${worksheet.rowCount} rows x ${worksheet.columnCount} columns\n`);
    
    // Check first 10 rows and first 10 columns for template code and name
    console.log('🔍 Scanning first 10 rows and columns for template code and name:\n');
    
    let foundCode = null;
    let foundName = null;
    let codeLocation = null;
    let nameLocation = null;
    
    // Scan rows 1-10, columns A-J
    for (let rowNum = 1; rowNum <= Math.min(10, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      for (let colNum = 1; colNum <= Math.min(10, worksheet.columnCount); colNum++) {
        const cell = row.getCell(colNum);
        const cellValue = getCellText(cell.value);
        
        if (cellValue) {
          // Check for PM/CM codes
          const pmMatch = cellValue.match(/(PM|CM)[\s\-_]?(\d{2,4})/i);
          if (pmMatch && !foundCode) {
            foundCode = pmMatch[0];
            codeLocation = `${getColumnLetter(colNum)}${rowNum}`;
            console.log(`  ✅ Template Code found: "${foundCode}" at ${codeLocation}`);
          }
          
          // Check for template name (long text, usually contains "Inspection", "Maintenance", etc.)
          if (cellValue.length > 20 && 
              (cellValue.toLowerCase().includes('inspection') || 
               cellValue.toLowerCase().includes('maintenance') ||
               cellValue.toLowerCase().includes('monitoring')) &&
              !foundName) {
            foundName = cellValue;
            nameLocation = `${getColumnLetter(colNum)}${rowNum}`;
            console.log(`  ✅ Template Name found: "${foundName}" at ${nameLocation}`);
          }
        }
      }
    }
    
    // If not found in first 10 rows, scan more
    if (!foundCode || !foundName) {
      console.log('\n🔍 Scanning more rows (11-20)...\n');
      for (let rowNum = 11; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        for (let colNum = 1; colNum <= Math.min(10, worksheet.columnCount); colNum++) {
          const cell = row.getCell(colNum);
          const cellValue = getCellText(cell.value);
          
          if (cellValue) {
            const pmMatch = cellValue.match(/(PM|CM)[\s\-_]?(\d{2,4})/i);
            if (pmMatch && !foundCode) {
              foundCode = pmMatch[0];
              codeLocation = `${getColumnLetter(colNum)}${rowNum}`;
              console.log(`  ✅ Template Code found: "${foundCode}" at ${codeLocation}`);
            }
            
            if (cellValue.length > 20 && 
                (cellValue.toLowerCase().includes('inspection') || 
                 cellValue.toLowerCase().includes('maintenance') ||
                 cellValue.toLowerCase().includes('monitoring')) &&
                !foundName) {
              foundName = cellValue;
              nameLocation = `${getColumnLetter(colNum)}${rowNum}`;
              console.log(`  ✅ Template Name found: "${foundName}" at ${nameLocation}`);
            }
          }
        }
      }
    }
    
    // Show row 3 specifically (current parser looks here)
    console.log('\n📋 Row 3 (current parser checks this row):');
    const row3 = worksheet.getRow(3);
    for (let colNum = 1; colNum <= Math.min(10, worksheet.columnCount); colNum++) {
      const cell = row3.getCell(colNum);
      const cellValue = getCellText(cell.value);
      if (cellValue) {
        console.log(`  ${getColumnLetter(colNum)}3: "${cellValue}"`);
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    if (foundCode) {
      console.log(`  Template Code: ${foundCode} (at ${codeLocation})`);
    } else {
      console.log(`  ❌ Template Code: NOT FOUND`);
    }
    
    if (foundName) {
      console.log(`  Template Name: ${foundName} (at ${nameLocation})`);
    } else {
      console.log(`  ❌ Template Name: NOT FOUND`);
    }
    
    return {
      fileName,
      templateCode: foundCode,
      templateName: foundName,
      codeLocation,
      nameLocation
    };
    
  } catch (error) {
    console.error(`❌ Error reading ${fileName}:`, error.message);
    return null;
  }
}

function getColumnLetter(colNum) {
  let result = '';
  while (colNum > 0) {
    colNum--;
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  return result;
}

async function analyzeAllTemplates() {
  const templatesDir = path.join(__dirname, '../templates/excel');
  
  if (!fs.existsSync(templatesDir)) {
    console.error(`❌ Templates directory not found: ${templatesDir}`);
    return;
  }
  
  const files = fs.readdirSync(templatesDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .sort();
  
  console.log(`\n🔍 Found ${files.length} Excel template files\n`);
  
  const results = [];
  
  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    const result = await analyzeExcelFile(filePath);
    if (result) {
      results.push(result);
    }
  }
  
  // Summary table
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 SUMMARY TABLE');
  console.log('='.repeat(100));
  console.log('\nFile Name'.padEnd(40) + 'Template Code'.padEnd(20) + 'Template Name'.padEnd(50));
  console.log('-'.repeat(110));
  
  results.forEach(r => {
    const code = r.templateCode || 'NOT FOUND';
    const name = (r.templateName || 'NOT FOUND').substring(0, 47);
    console.log(r.fileName.padEnd(40) + code.padEnd(20) + name.padEnd(50));
  });
  
  console.log('\n' + '='.repeat(100));
  console.log(`\n✅ Analyzed ${results.length} templates`);
  console.log(`   Found codes: ${results.filter(r => r.templateCode).length}`);
  console.log(`   Found names: ${results.filter(r => r.templateName).length}`);
  console.log('\n');
}

if (require.main === module) {
  analyzeAllTemplates().catch(console.error);
}

module.exports = { analyzeExcelFile, analyzeAllTemplates };
