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
  
  // Get name from F3 (primary), fallback to G3, H3
  const cellF3 = row3.getCell(6);
  let templateName = getCellText(cellF3.value);
  
  // If F3 is empty or looks like a code, check G3 and H3
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
  
  // Extract frequency
  let frequency = 'monthly';
  const nameLower = templateName.toLowerCase();
  if (nameLower.includes('annual')) {
    frequency = 'annually';
  } else if (nameLower.includes('monthly')) {
    frequency = 'monthly';
  } else if (nameLower.includes('weekly')) {
    frequency = 'weekly';
  } else if (nameLower.includes('quarterly') || nameLower.includes('quaterly')) {
    frequency = 'quarterly';
  } else if (nameLower.includes('biannual') || nameLower.includes('bi-annual')) {
    frequency = 'bi-monthly';
  }
  
  return { templateCode, templateName, frequency };
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

/**
 * Map Excel files to database templates by template name and code
 */
function mapExcelToDatabase(excelInfo, dbTemplates) {
  const mapping = [];
  const usedDbIds = new Set();
  
  excelInfo.forEach((excel, file) => {
    // First try: Match by template code (most reliable)
    let match = dbTemplates.find(db => 
      !usedDbIds.has(db.id) && db.template_code === excel.templateCode
    );
    
    // Second try: Match by template name (exact or very similar)
    if (!match) {
      match = dbTemplates.find(db => {
        if (usedDbIds.has(db.id)) return false;
        
        const dbName = db.template_name.toLowerCase().trim();
        const excelName = excel.templateName.toLowerCase().trim();
        
        // Exact match
        if (dbName === excelName) return true;
        
        // Remove common words and compare
        const removeCommon = (str) => str.replace(/\b(inspection|of|for|the|a|an)\b/gi, '').trim();
        const dbClean = removeCommon(dbName);
        const excelClean = removeCommon(excelName);
        
        if (dbClean === excelClean) return true;
        
        // Check if one contains the other (for variations)
        if (dbName.includes(excelName) || excelName.includes(dbName)) {
          return true;
        }
        
        // Partial match (key words)
        const dbWords = dbClean.split(/\s+/).filter(w => w.length > 3);
        const excelWords = excelClean.split(/\s+/).filter(w => w.length > 3);
        const commonWords = dbWords.filter(w => excelWords.includes(w));
        if (commonWords.length >= 2) return true;
        
        return false;
      });
    }
    
    if (match) {
      usedDbIds.add(match.id);
    }
    
    mapping.push({
      file,
      excel,
      db: match || null
    });
  });
  
  return mapping;
}

async function syncTemplates() {
  try {
    console.log('🔄 Syncing Database Templates with Excel Files\n');
    console.log('='.repeat(100));
    
    const templatesDir = path.join(__dirname, '../templates/excel');
    const files = fs.readdirSync(templatesDir)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
      .sort();
    
    // Get template info from all Excel files
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
    
    // Map Excel to Database
    const mapping = mapExcelToDatabase(excelTemplates, dbResult.rows);
    
    // Resolve conflicts
    const codeUsage = new Map();
    excelTemplates.forEach((info, file) => {
      if (!codeUsage.has(info.templateCode)) {
        codeUsage.set(info.templateCode, []);
      }
      codeUsage.get(info.templateCode).push({ file, ...info });
    });
    
    // Conflict resolution rules
    // PM-003: Keep SCADA Strings as PM-003, assign new code to String Combiner
    // PM-005: Keep SCADA Trackers as PM-005, assign new code to Tracker
    const stringCombinerCode = await findNextAvailablePM(24);
    const trackerCode = await findNextAvailablePM(parseInt(stringCombinerCode.split('-')[1]) + 1);
    
    const conflictResolutions = {
      'PM-003': {
        'String-Combiner-box-Inspection.xlsx': stringCombinerCode
      },
      'PM-005': {
        'Tracker.xlsx': trackerCode
      }
    };
    
    console.log('\n📋 SYNC PLAN:\n');
    
    const updates = [];
    
    mapping.forEach(m => {
      const excel = m.excel;
      const db = m.db;
      
      // Check if this file has a conflict resolution
      let finalCode = excel.templateCode;
      if (conflictResolutions[excel.templateCode] && conflictResolutions[excel.templateCode][m.file]) {
        finalCode = conflictResolutions[excel.templateCode][m.file];
        console.log(`  ${m.file}:`);
        console.log(`    Excel Code: ${excel.templateCode} -> Resolved to: ${finalCode} (conflict resolution)`);
      } else {
        finalCode = excel.templateCode;
      }
      
      if (db) {
        // Update existing template
        if (db.template_code !== finalCode || db.template_name !== excel.templateName) {
          console.log(`  ${m.file}:`);
          console.log(`    Database: ${db.template_code} - "${db.template_name}"`);
          console.log(`    Excel:    ${finalCode} - "${excel.templateName}"`);
          console.log(`    Action:   UPDATE to match Excel`);
          
          updates.push({
            id: db.id,
            code: finalCode,
            name: excel.templateName,
            frequency: excel.frequency
          });
        } else {
          console.log(`  ${m.file}: ✅ Already synced (${finalCode})`);
        }
      } else {
        console.log(`  ${m.file}: ⚠️  No database match found for "${excel.templateName}"`);
      }
    });
    
    if (updates.length === 0) {
      console.log('\n✅ All templates are already synced!\n');
      return;
    }
    
    console.log(`\n\n📝 Will update ${updates.length} templates:\n`);
    
    // Ask for confirmation
    const args = process.argv.slice(2);
    const confirm = args.includes('--confirm');
    
    if (!confirm) {
      console.log('⚠️  Run with --confirm to apply updates\n');
      return;
    }
    
    // Apply updates
    console.log('\n🔄 Applying updates...\n');
    
    for (const update of updates) {
      await pool.query(`
        UPDATE checklist_templates
        SET template_code = $1,
            template_name = $2,
            frequency = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [update.code, update.name, update.frequency, update.id]);
      
      console.log(`  ✅ Updated: ${update.code} - "${update.name}"`);
    }
    
    console.log('\n✅ Sync complete!\n');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  syncTemplates();
}

module.exports = { syncTemplates };
