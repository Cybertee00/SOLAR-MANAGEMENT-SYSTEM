/**
 * VALIDATION SCRIPT: Ensures template parser reads exactly from Excel files
 * 
 * This script validates that:
 * 1. Template codes are extracted from A3 (row 3, column A)
 * 2. Template names are extracted from F3 (row 3, column F)
 * 3. All Excel files are correctly parsed
 * 4. No assumptions are made - everything is read from the actual Excel files
 * 
 * Run this after any template parser changes to ensure correctness.
 */

require('dotenv').config();
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { parseExcelFile } = require('../utils/templateParser');

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
 * Manually read template code and name from Excel (ground truth)
 */
async function readFromExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const row3 = worksheet.getRow(3);
  
  // A3: Template Code
  const cellA3 = row3.getCell(1);
  const codeText = getCellText(cellA3.value);
  const pmMatch = codeText.match(/(PM|CM)[\s\-_]?(\d{2,4})/i);
  let templateCode = null;
  if (pmMatch) {
    templateCode = `PM-${String(pmMatch[2]).padStart(3, '0')}`;
  }
  
  // F3: Template Name
  const cellF3 = row3.getCell(6);
  let templateName = getCellText(cellF3.value);
  
  // Fallback to G3, H3 if F3 is empty or looks like a code
  if (!templateName || templateName.length < 10 || /^PM-\d{3}$/i.test(templateName)) {
    const cellG3 = row3.getCell(7);
    const cellH3 = row3.getCell(8);
    const g3Text = getCellText(cellG3.value);
    const h3Text = getCellText(cellH3.value);
    
    if (g3Text && g3Text.length > templateName.length && !/^PM-\d{3}$/i.test(g3Text)) {
      templateName = g3Text;
    }
    if (h3Text && h3Text.length > templateName.length && !/^PM-\d{3}$/i.test(h3Text)) {
      templateName = h3Text;
    }
  }
  
  return { templateCode, templateName };
}

/**
 * Validate parser extraction matches manual Excel reading
 */
async function validateParser() {
  const templatesDir = path.join(__dirname, '../templates/excel');
  
  if (!fs.existsSync(templatesDir)) {
    console.error(`❌ Templates directory not found: ${templatesDir}`);
    return;
  }
  
  const files = fs.readdirSync(templatesDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .sort();
  
  console.log('🔍 Validating Template Parser\n');
  console.log('='.repeat(120));
  console.log('Testing that parser reads EXACTLY from Excel files (A3 for code, F3 for name)\n');
  
  let allPassed = true;
  const results = [];
  
  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    
    // Manual read (ground truth)
    const excelData = await readFromExcel(filePath);
    
    // Parser read
    let parserData = null;
    try {
      const parsed = await parseExcelFile(filePath, 'test', 'test', file);
      parserData = {
        templateCode: parsed.template_code,
        templateName: parsed.template_name
      };
    } catch (error) {
      parserData = { error: error.message };
    }
    
    // Compare
    const codeMatch = excelData.templateCode === parserData.templateCode;
    const nameMatch = excelData.templateName === parserData.templateName;
    const passed = codeMatch && nameMatch && !parserData.error;
    
    if (!passed) {
      allPassed = false;
    }
    
    results.push({
      file,
      excel: excelData,
      parser: parserData,
      codeMatch,
      nameMatch,
      passed
    });
    
    // Display result
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${file}`);
    
    if (!codeMatch) {
      console.log(`   Code: Excel="${excelData.templateCode}" Parser="${parserData.templateCode}" ❌`);
    }
    if (!nameMatch) {
      console.log(`   Name: Excel="${excelData.templateName}" Parser="${parserData.templateName}" ❌`);
    }
    if (parserData.error) {
      console.log(`   Error: ${parserData.error} ❌`);
    }
    if (passed) {
      console.log(`   ✅ Code: ${excelData.templateCode}, Name: "${excelData.templateName}"`);
    }
    console.log('');
  }
  
  console.log('='.repeat(120));
  if (allPassed) {
    console.log('\n✅ ALL VALIDATIONS PASSED');
    console.log('   The parser correctly reads template codes and names from Excel files.\n');
  } else {
    console.log('\n❌ VALIDATION FAILED');
    console.log('   Some templates were not parsed correctly.\n');
    
    const failed = results.filter(r => !r.passed);
    console.log(`   Failed: ${failed.length}/${results.length} templates\n`);
  }
  
  return allPassed;
}

if (require.main === module) {
  validateParser().catch(console.error);
}

module.exports = { validateParser, readFromExcel };
