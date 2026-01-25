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
 * Verify Excel structure and extract exact template code and name
 */
async function verifyExcelStructure(filePath) {
  const fileName = path.basename(filePath);
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { error: 'No worksheet found' };
    }
    
    // Get row 3 (where template code and name are)
    const row3 = worksheet.getRow(3);
    
    // Cell A3: Template Code
    const cellA3 = row3.getCell(1);
    const codeRaw = getCellText(cellA3.value);
    
    // Extract PM/CM code
    const pmMatch = codeRaw.match(/(PM|CM)[\s\-_]?(\d{2,4})/i);
    let templateCode = null;
    if (pmMatch) {
      templateCode = `PM-${String(pmMatch[2]).padStart(3, '0')}`;
    }
    
    // Cell F3: Template Name (based on analysis)
    const cellF3 = row3.getCell(6);
    let templateName = getCellText(cellF3.value);
    
    // If F3 is empty, check G3, H3
    if (!templateName || templateName.length < 10) {
      const cellG3 = row3.getCell(7);
      const cellH3 = row3.getCell(8);
      const g3Text = getCellText(cellG3.value);
      const h3Text = getCellText(cellH3.value);
      
      if (g3Text && g3Text.length > templateName.length) {
        templateName = g3Text;
      }
      if (h3Text && h3Text.length > templateName.length) {
        templateName = h3Text;
      }
    }
    
    // Extract frequency from template name or filename
    let frequency = 'monthly';
    const nameLower = templateName.toLowerCase();
    const fileLower = fileName.toLowerCase();
    
    if (nameLower.includes('annual') || fileLower.includes('annual')) {
      frequency = 'annually';
    } else if (nameLower.includes('monthly') || fileLower.includes('monthly')) {
      frequency = 'monthly';
    } else if (nameLower.includes('weekly') || fileLower.includes('weekly')) {
      frequency = 'weekly';
    } else if (nameLower.includes('quarterly') || nameLower.includes('quaterly') || fileLower.includes('quarterly') || fileLower.includes('quaterly')) {
      frequency = 'quarterly';
    } else if (nameLower.includes('biannual') || nameLower.includes('bi-annual') || fileLower.includes('biannual')) {
      frequency = 'bi-monthly';
    }
    
    return {
      fileName,
      templateCode,
      templateName,
      frequency,
      codeLocation: 'A3',
      nameLocation: 'F3',
      rawCode: codeRaw
    };
    
  } catch (error) {
    return { error: error.message };
  }
}

async function verifyAllTemplates() {
  const templatesDir = path.join(__dirname, '../templates/excel');
  
  if (!fs.existsSync(templatesDir)) {
    console.error(`❌ Templates directory not found: ${templatesDir}`);
    return;
  }
  
  const files = fs.readdirSync(templatesDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .sort();
  
  console.log(`\n🔍 Verifying ${files.length} Excel templates\n`);
  
  const results = [];
  const codeMap = new Map(); // Track code conflicts
  
  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    const result = await verifyExcelStructure(filePath);
    
    if (result.error) {
      console.log(`❌ ${file}: ${result.error}`);
      continue;
    }
    
    results.push(result);
    
    // Track code usage
    if (result.templateCode) {
      if (!codeMap.has(result.templateCode)) {
        codeMap.set(result.templateCode, []);
      }
      codeMap.get(result.templateCode).push(result);
    }
  }
  
  // Display results
  console.log('\n' + '='.repeat(120));
  console.log('📊 TEMPLATE VERIFICATION RESULTS');
  console.log('='.repeat(120));
  console.log('\nFile Name'.padEnd(35) + 'Template Code'.padEnd(18) + 'Template Name'.padEnd(55) + 'Frequency');
  console.log('-'.repeat(120));
  
  results.forEach(r => {
    const code = r.templateCode || 'NOT FOUND';
    const name = (r.templateName || 'NOT FOUND').substring(0, 53);
    const freq = r.frequency || 'unknown';
    console.log(r.fileName.padEnd(35) + code.padEnd(18) + name.padEnd(55) + freq);
  });
  
  // Check for conflicts
  console.log('\n\n' + '='.repeat(120));
  console.log('⚠️  CODE CONFLICTS (same PM code used by multiple templates)');
  console.log('='.repeat(120));
  
  let hasConflicts = false;
  codeMap.forEach((templates, code) => {
    if (templates.length > 1) {
      hasConflicts = true;
      console.log(`\n${code} is used by ${templates.length} templates:`);
      templates.forEach(t => {
        console.log(`  - ${t.fileName}: "${t.templateName}"`);
      });
    }
  });
  
  if (!hasConflicts) {
    console.log('\n✅ No conflicts found - all templates have unique codes');
  }
  
  console.log('\n' + '='.repeat(120));
  console.log(`\n✅ Verified ${results.length} templates`);
  console.log(`   Codes found: ${results.filter(r => r.templateCode).length}`);
  console.log(`   Names found: ${results.filter(r => r.templateName).length}`);
  console.log('\n');
  
  return results;
}

if (require.main === module) {
  verifyAllTemplates().catch(console.error);
}

module.exports = { verifyExcelStructure, verifyAllTemplates };
