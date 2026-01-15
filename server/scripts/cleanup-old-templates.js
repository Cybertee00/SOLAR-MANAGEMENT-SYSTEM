/**
 * Cleanup old checklist templates that are not in the current Excel files
 * Removes all templates except the 13 currently in server/templates/excel
 * 
 * Usage: node scripts/cleanup-old-templates.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Asset type mapping (same as in update script)
const ASSET_TYPE_MAPPING = {
  'CCTV-Annual.xlsx': { asset_type: 'cctv', prefix: 'CCTV' },
  'CCTV-Monthly.xlsx': { asset_type: 'cctv', prefix: 'CCTV' },
  'Concentrated-Cabinet.xlsx': { asset_type: 'concentrated_cabinet', prefix: 'CC' },
  'CT-MV.xlsx': { asset_type: 'ct_mv', prefix: 'CT-MV' },
  'Energy-Meter.xlsx': { asset_type: 'energy_meter', prefix: 'EM' },
  'Inverters.xlsx': { asset_type: 'inverter', prefix: 'INV' },
  'SCADA-Stings-monitoring.xlsx': { asset_type: 'scada', prefix: 'SCADA-STRINGS' },
  'SCADA-Trackers-monitoring.xlsx': { asset_type: 'scada', prefix: 'SCADA-TRACKERS' },
  'String-Combiner-box-Inspection.xlsx': { asset_type: 'string_combiner_box', prefix: 'SCB' },
  'SUBSTATION-BATTERIES.xlsx': { asset_type: 'substation', prefix: 'SUB-BATTERIES' },
  'Substation.xlsx': { asset_type: 'substation', prefix: 'SUB' },
  'Tracker.xlsx': { asset_type: 'tracker', prefix: 'TRACKER' },
  'Ventilation.xlsx': { asset_type: 'ventilation', prefix: 'VENT' }
};

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
 * Extract template code (e.g., PM-014) from Excel file
 */
function extractTemplateCode(worksheet) {
  const row3 = worksheet.getRow(3);
  const cellA3 = row3.getCell(1);
  let code = getCellText(cellA3.value);
  
  const pmCodeMatch = code.match(/(PM|CM)-?(\d{3})/i);
  if (pmCodeMatch) {
    return `${pmCodeMatch[1].toUpperCase()}-${pmCodeMatch[2]}`;
  }
  
  row3.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = getCellText(cell.value);
    const match = text.match(/(PM|CM)-?(\d{3})/i);
    if (match) {
      code = `${match[1].toUpperCase()}-${match[2]}`;
      return false;
    }
  });
  
  return code || null;
}

/**
 * Extract metadata from Excel file (template code, title, frequency)
 */
function extractMetadata(worksheet, assetPrefix, fileName) {
  const templateCodeRaw = extractTemplateCode(worksheet);
  
  // Build proper template code (e.g., EM-PM-014)
  let templateCode = null;
  if (templateCodeRaw) {
    if (templateCodeRaw.match(/^(PM|CM)-\d{3}$/i)) {
      templateCode = `${assetPrefix}-${templateCodeRaw}`;
    } else {
      templateCode = templateCodeRaw;
    }
  } else {
    templateCode = `${assetPrefix}-PM`;
  }
  
  // Special handling for CCTV files
  if (fileName && fileName.toLowerCase().includes('annual')) {
    templateCode = templateCode.replace(/PM-\d{3}$/, 'PM-ANNUAL');
  } else if (fileName && fileName.toLowerCase().includes('monthly')) {
    templateCode = templateCode.replace(/PM-\d{3}$/, 'PM-MONTHLY');
  }
  
  return templateCode;
}

/**
 * Get all valid template codes from Excel files
 */
async function getValidTemplateCodes() {
  const templatesDir = path.join(__dirname, '../templates/excel');
  const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.xlsx'));
  const validCodes = new Set();
  
  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    const fileName = path.basename(file);
    const assetInfo = ASSET_TYPE_MAPPING[fileName];
    
    if (!assetInfo) continue;
    
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      
      if (worksheet) {
        const templateCode = extractMetadata(worksheet, assetInfo.prefix, fileName);
        validCodes.add(templateCode);
        console.log(`  ✓ Found: ${templateCode} from ${fileName}`);
      }
    } catch (error) {
      console.error(`  ✗ Error reading ${fileName}:`, error.message);
    }
  }
  
  return validCodes;
}

/**
 * Main cleanup function
 */
async function cleanupOldTemplates() {
  try {
    console.log('='.repeat(80));
    console.log('CLEANING UP OLD CHECKLIST TEMPLATES');
    console.log('='.repeat(80));
    console.log('');
    
    // Get all valid template codes from Excel files
    console.log('Scanning Excel files for valid template codes...');
    const validCodes = await getValidTemplateCodes();
    console.log(`\nFound ${validCodes.size} valid template codes:\n`);
    Array.from(validCodes).sort().forEach(code => console.log(`  - ${code}`));
    console.log('');
    
    // Get all templates from database
    const allTemplates = await pool.query('SELECT id, template_code, template_name FROM checklist_templates ORDER BY template_code');
    console.log(`Database contains ${allTemplates.rows.length} templates\n`);
    
    // Find templates to delete
    const templatesToDelete = allTemplates.rows.filter(t => !validCodes.has(t.template_code));
    
    if (templatesToDelete.length === 0) {
      console.log('✓ No templates to delete. All templates are valid.');
      return;
    }
    
    console.log(`Found ${templatesToDelete.length} template(s) to delete:\n`);
    templatesToDelete.forEach(t => {
      console.log(`  - ${t.template_code} (${t.template_name})`);
    });
    console.log('');
    
    // Delete templates
    let deleted = 0;
    for (const template of templatesToDelete) {
      try {
        await pool.query('DELETE FROM checklist_templates WHERE id = $1', [template.id]);
        console.log(`  ✓ Deleted: ${template.template_code} - ${template.template_name}`);
        deleted++;
      } catch (error) {
        console.error(`  ✗ Error deleting ${template.template_code}:`, error.message);
      }
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`Valid templates: ${validCodes.size}`);
    console.log(`Templates deleted: ${deleted}`);
    console.log(`Remaining templates: ${allTemplates.rows.length - deleted}`);
    console.log('');
    console.log('✓ Cleanup complete!');
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  cleanupOldTemplates()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldTemplates };
