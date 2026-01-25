require('dotenv').config();
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

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
 * Get template code and name from Excel file
 */
async function getTemplateInfoFromExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const row3 = worksheet.getRow(3);
  
  // Get code from A3
  const cellA3 = row3.getCell(1);
  const codeText = getCellText(cellA3.value);
  const pmMatch = codeText.match(/(PM|CM)[\s\-_]?(\d{2,4})/i);
  let templateCode = null;
  if (pmMatch) {
    templateCode = `PM-${String(pmMatch[2]).padStart(3, '0')}`;
  }
  
  // Get name from F3
  const cellF3 = row3.getCell(6);
  let templateName = getCellText(cellF3.value);
  
  return { templateCode, templateName };
}

/**
 * Find next available PM number
 */
async function findNextAvailablePM(startFrom = 1) {
  const result = await pool.query(`
    SELECT DISTINCT template_code 
    FROM checklist_templates 
    WHERE template_code ~ '^PM-\\d{3}$'
    ORDER BY template_code
  `);
  
  const usedCodes = new Set(result.rows.map(r => r.template_code));
  
  for (let i = startFrom; i <= 999; i++) {
    const code = `PM-${String(i).padStart(3, '0')}`;
    if (!usedCodes.has(code)) {
      return code;
    }
  }
  
  return null;
}

async function resolveConflicts() {
  try {
    console.log('🔍 Analyzing template conflicts...\n');
    
    const templatesDir = path.join(__dirname, '../templates/excel');
    const files = fs.readdirSync(templatesDir)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
      .sort();
    
    // Map of Excel file -> template info
    const excelTemplates = new Map();
    
    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const info = await getTemplateInfoFromExcel(filePath);
      excelTemplates.set(file, info);
    }
    
    // Get all database templates
    const dbResult = await pool.query(`
      SELECT id, template_code, template_name, asset_type, frequency
      FROM checklist_templates
      ORDER BY template_code, template_name
    `);
    
    console.log('📊 Current Database Templates:\n');
    dbResult.rows.forEach(t => {
      console.log(`  ${t.template_code} - ${t.template_name} (${t.asset_type}, ${t.frequency})`);
    });
    
    console.log('\n\n📊 Excel File Templates:\n');
    excelTemplates.forEach((info, file) => {
      console.log(`  ${file}: ${info.templateCode} - ${info.templateName}`);
    });
    
    // Find conflicts
    console.log('\n\n⚠️  CONFLICTS DETECTED:\n');
    
    const conflicts = {
      'PM-003': [],
      'PM-005': [],
      'PM-017': []
    };
    
    excelTemplates.forEach((info, file) => {
      if (conflicts[info.templateCode]) {
        conflicts[info.templateCode].push({ file, ...info });
      }
    });
    
    // PM-017 is OK (CCTV Annual and Monthly share code - intentional)
    if (conflicts['PM-017'].length === 2) {
      console.log('✅ PM-017: CCTV Annual and Monthly (INTENTIONAL - share code, differentiated by name)');
    }
    
    // PM-003 conflict
    if (conflicts['PM-003'].length > 1) {
      console.log('\n❌ PM-003 CONFLICT:');
      conflicts['PM-003'].forEach(t => {
        console.log(`  - ${t.file}: "${t.templateName}"`);
      });
      
      // Assign new code to String Combiner box (keep SCADA Strings as PM-003)
      const combinerBox = conflicts['PM-003'].find(t => t.file.includes('Combiner'));
      if (combinerBox) {
        const newCode = await findNextAvailablePM(22);
        console.log(`\n💡 Solution: Assign ${newCode} to "${combinerBox.templateName}"`);
        console.log(`   (Keep SCADA Strings as PM-003)`);
      }
    }
    
    // PM-005 conflict
    if (conflicts['PM-005'].length > 1) {
      console.log('\n❌ PM-005 CONFLICT:');
      conflicts['PM-005'].forEach(t => {
        console.log(`  - ${t.file}: "${t.templateName}"`);
      });
      
      // Assign new code to Tracker (keep SCADA Trackers as PM-005)
      const tracker = conflicts['PM-005'].find(t => t.file.includes('Tracker') && !t.file.includes('SCADA'));
      if (tracker) {
        const newCode = await findNextAvailablePM(22);
        console.log(`\n💡 Solution: Assign ${newCode} to "${tracker.templateName}"`);
        console.log(`   (Keep SCADA Trackers as PM-005)`);
      }
    }
    
    console.log('\n\n✅ Analysis complete\n');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  resolveConflicts();
}

module.exports = { resolveConflicts, findNextAvailablePM };
