/**
 * Update and replace all checklist templates from Excel files
 * Reads all .xlsx files from server/templates/excel and updates the database
 * 
 * Usage: node scripts/update-all-excel-templates.js
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

// Mapping of Excel file names to asset type and prefix
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
 * Usually found in row 3, column A
 */
function extractTemplateCode(worksheet) {
  // Check row 3, column A (most common location)
  const row3 = worksheet.getRow(3);
  const cellA3 = row3.getCell(1);
  let code = getCellText(cellA3.value);
  
  // Look for pattern like PM-014, PM-013, etc.
  const pmCodeMatch = code.match(/(PM|CM)-?(\d{3})/i);
  if (pmCodeMatch) {
    return `${pmCodeMatch[1].toUpperCase()}-${pmCodeMatch[2]}`;
  }
  
  // Check other cells in row 3
  row3.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = getCellText(cell.value);
    const match = text.match(/(PM|CM)-?(\d{3})/i);
    if (match) {
      code = `${match[1].toUpperCase()}-${match[2]}`;
      return false; // Stop iteration
    }
  });
  
  return code || null;
}

/**
 * Extract frequency from title text or filename
 * Looks for words like "Monthly", "Annual", "Daily", "Weekly", "Quarterly"
 */
function extractFrequency(titleText, fileName) {
  // Check filename first (for cases like CCTV-Annual.xlsx)
  const fileNameLower = (fileName || '').toLowerCase();
  if (fileNameLower.includes('annual')) {
    return 'annually';
  }
  if (fileNameLower.includes('monthly')) {
    return 'monthly';
  }
  if (fileNameLower.includes('weekly')) {
    return 'weekly';
  }
  if (fileNameLower.includes('daily')) {
    return 'daily';
  }
  
  if (!titleText) return 'monthly'; // Default
  
  const text = titleText.toLowerCase();
  
  if (text.includes('daily') || text.includes('day')) {
    return 'daily';
  }
  if (text.includes('weekly') || text.includes('week')) {
    return 'weekly';
  }
  if (text.includes('monthly') || text.includes('month')) {
    return 'monthly';
  }
  if (text.includes('quarterly') || text.includes('quarter') || text.includes('quaterly')) {
    return 'quarterly';
  }
  if (text.includes('biannual') || text.includes('bi-annual')) {
    return 'bi-monthly';
  }
  if (text.includes('annually') || text.includes('annual') || text.includes('yearly') || text.includes('year')) {
    return 'annually';
  }
  if (text.includes('bi-monthly') || text.includes('bimonthly')) {
    return 'bi-monthly';
  }
  
  return 'monthly'; // Default fallback
}

/**
 * Extract title from Excel file
 * Usually found in row 3, columns F-H
 */
function extractTitle(worksheet) {
  const row3 = worksheet.getRow(3);
  let title = '';
  
  // Check columns F, G, H (common locations for title)
  for (let col = 6; col <= 8; col++) {
    const cell = row3.getCell(col);
    const text = getCellText(cell.value);
    if (text && text.length > title.length) {
      title = text;
    }
  }
  
  // If not found, check all cells in row 3
  if (!title) {
    row3.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell.value);
      // Skip if it's a PM code
      if (!text.match(/^(PM|CM)-?\d{3}/i) && text.length > 10) {
        if (text.length > title.length) {
          title = text;
        }
      }
    });
  }
  
  return title || '';
}

/**
 * Detect header row in worksheet
 */
function findHeaderRow(worksheet, maxRows = 30) {
  const headerKeywords = ['s/n', 'sn', 'no', 'item', 'check', 'inspection', 'activity', 'parameter', 'result', 'pass', 'fail', 'remarks', 'observation', 'description'];
  
  for (let r = 1; r <= Math.min(maxRows, worksheet.rowCount || maxRows); r++) {
    const row = worksheet.getRow(r);
    const texts = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text) texts.push(text);
    });
    
    if (texts.length === 0) continue;
    
    const matches = headerKeywords.filter(k => texts.some(t => t.includes(k)));
    if (matches.length >= 2) {
      return r;
    }
  }
  return null;
}

/**
 * Extract metadata from Excel file (template code, title, frequency)
 */
function extractMetadata(worksheet, assetPrefix, fileName) {
  const templateCodeRaw = extractTemplateCode(worksheet);
  const title = extractTitle(worksheet);
  const frequency = extractFrequency(title, fileName);
  
  // Build proper template code (e.g., EM-PM-014)
  let templateCode = null;
  if (templateCodeRaw) {
    // If we found PM-014, combine with asset prefix
    if (templateCodeRaw.match(/^(PM|CM)-\d{3}$/i)) {
      templateCode = `${assetPrefix}-${templateCodeRaw}`;
    } else {
      templateCode = templateCodeRaw;
    }
  } else {
    // Fallback: use asset prefix with PM
    templateCode = `${assetPrefix}-PM`;
  }
  
  // Special handling for CCTV files - differentiate Annual vs Monthly
  if (fileName && fileName.toLowerCase().includes('annual')) {
    templateCode = templateCode.replace(/PM-\d{3}$/, 'PM-ANNUAL');
  } else if (fileName && fileName.toLowerCase().includes('monthly')) {
    templateCode = templateCode.replace(/PM-\d{3}$/, 'PM-MONTHLY');
  }
  
  return {
    template_code: templateCode,
    title: title,
    frequency: frequency
  };
}

/**
 * Parse Excel file to extract checklist structure
 */
async function parseExcelTemplate(filePath, assetPrefix, fileName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const sections = [];
  let currentSection = null;
  
  // Process the first worksheet (most templates use single sheet)
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheets found in Excel file');
  }
  
  // Extract metadata (need fileName for frequency detection)
  const metadata = extractMetadata(worksheet, assetPrefix, fileName);
  
  const headerRow = findHeaderRow(worksheet);
  const startRow = headerRow ? headerRow + 1 : 1;
  
  // Find columns that might contain item descriptions
  let itemCol = null;
  let passFailCol = null;
  let remarksCol = null;
  
  if (headerRow) {
    const headerRowData = worksheet.getRow(headerRow);
    headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(cell.value).toLowerCase();
      if (text.includes('item') || text.includes('description') || text.includes('check') || text.includes('inspection')) {
        itemCol = colNumber;
      }
      if (text.includes('pass') || text.includes('fail') || text.includes('result')) {
        passFailCol = colNumber;
      }
      if (text.includes('remark') || text.includes('observation') || text.includes('note')) {
        remarksCol = colNumber;
      }
    });
  }
  
  // If we couldn't detect columns, use common patterns
  if (!itemCol) itemCol = 2; // Usually column B
  if (!passFailCol) passFailCol = 3; // Usually column C
  
  // Parse rows
  let itemIndex = 0;
  for (let r = startRow; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const itemCell = row.getCell(itemCol);
    const itemText = getCellText(itemCell.value);
    
    // Skip empty rows
    if (!itemText) continue;
    
    // Check if this is a section header (usually bold, all caps, or longer text)
    const isSectionHeader = itemText.length > 30 || 
                           itemText === itemText.toUpperCase() ||
                           (itemCell.font && itemCell.font.bold);
    
    if (isSectionHeader && itemText.length > 10) {
      // Start a new section
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      
      currentSection = {
        id: `section_${sections.length + 1}`,
        title: itemText,
        items: []
      };
    } else if (currentSection && itemText.length > 0) {
      // Add item to current section
      itemIndex++;
      const item = {
        id: `item_${sections.length + 1}_${itemIndex}`,
        type: 'pass_fail',
        label: itemText,
        required: true,
        has_observations: !!remarksCol
      };
      
      // Check if there's a remarks/observations column
      if (remarksCol) {
        const remarksCell = row.getCell(remarksCol);
        const remarksText = getCellText(remarksCell.value);
        if (remarksText) {
          item.placeholder = remarksText;
        }
      }
      
      currentSection.items.push(item);
    }
  }
  
  // Add the last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  // If no sections were found, create a default structure
  if (sections.length === 0) {
    sections.push({
      id: 'section_1',
      title: 'Inspection Items',
      items: [{
        id: 'item_1_1',
        type: 'pass_fail',
        label: 'General Inspection',
        required: true,
        has_observations: true
      }]
    });
  }
  
  return {
    metadata: {
      procedure: metadata.template_code.split('-').pop() || 'PM',
      plant: 'WITKOP SOLAR PLANT',
      requires_team: true,
      requires_date: true,
      requires_time: true,
      requires_location: true
    },
    sections: sections,
    extractedMetadata: metadata
  };
}

/**
 * Update or insert template in database
 */
async function upsertTemplate(templateData, checklistStructure) {
  const { template_code, template_name, description, asset_type, task_type, frequency } = templateData;
  
  // Check if template exists
  const existing = await pool.query(
    'SELECT id FROM checklist_templates WHERE template_code = $1',
    [template_code]
  );
  
  if (existing.rows.length > 0) {
    // Update existing template
    await pool.query(
      `UPDATE checklist_templates 
       SET template_name = $1,
           description = $2,
           asset_type = $3,
           task_type = $4,
           frequency = $5,
           checklist_structure = $6::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE template_code = $7`,
      [
        template_name,
        description,
        asset_type,
        task_type,
        frequency,
        JSON.stringify(checklistStructure),
        template_code
      ]
    );
    return 'updated';
  } else {
    // Insert new template
    await pool.query(
      `INSERT INTO checklist_templates 
       (template_code, template_name, description, asset_type, task_type, frequency, checklist_structure, validation_rules, cm_generation_rules)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)`,
      [
        template_code,
        template_name,
        description,
        asset_type,
        task_type,
        frequency,
        JSON.stringify(checklistStructure),
        JSON.stringify({}),
        JSON.stringify({})
      ]
    );
    return 'inserted';
  }
}

/**
 * Main function to process all Excel templates
 */
async function updateAllTemplates() {
  try {
    console.log('='.repeat(80));
    console.log('UPDATING ALL CHECKLIST TEMPLATES FROM EXCEL FILES');
    console.log('='.repeat(80));
    console.log('');
    
    const templatesDir = path.join(__dirname, '../templates/excel');
    
    if (!fs.existsSync(templatesDir)) {
      console.error(`❌ Templates directory not found: ${templatesDir}`);
      process.exit(1);
    }
    
    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.xlsx'));
    console.log(`Found ${files.length} Excel template file(s)\n`);
    
    if (files.length === 0) {
      console.log('No Excel files found in templates directory.');
      return;
    }
    
    let processed = 0;
    let updated = 0;
    let inserted = 0;
    let errors = 0;
    
    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const fileName = path.basename(file);
      
      console.log(`Processing: ${fileName}`);
      
      // Get asset type and prefix from mapping
      const assetInfo = ASSET_TYPE_MAPPING[fileName];
      
      if (!assetInfo) {
        console.log(`  ⚠️  No asset mapping found for ${fileName}, skipping...`);
        console.log('');
        continue;
      }
      
      try {
        // Parse Excel file (this will extract template code and frequency)
        const checklistStructure = await parseExcelTemplate(filePath, assetInfo.prefix, fileName);
        
        // Get extracted metadata
        const extracted = checklistStructure.extractedMetadata;
        
        // Build template data
        const templateData = {
          template_code: extracted.template_code,
          template_name: extracted.title || `${assetInfo.asset_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Inspection`,
          description: extracted.title || `${assetInfo.asset_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Preventive Maintenance`,
          asset_type: assetInfo.asset_type,
          task_type: 'PM',
          frequency: extracted.frequency
        };
        
        console.log(`  Extracted: Code=${templateData.template_code}, Frequency=${templateData.frequency}`);
        
        // Upsert template
        const action = await upsertTemplate(templateData, checklistStructure);
        
        if (action === 'updated') {
          updated++;
          console.log(`  ✓ Updated: ${templateData.template_code} - ${templateData.template_name}`);
        } else {
          inserted++;
          console.log(`  ✓ Inserted: ${templateData.template_code} - ${templateData.template_name}`);
        }
        
        const totalItems = checklistStructure.sections.reduce((sum, s) => sum + s.items.length, 0);
        console.log(`    Sections: ${checklistStructure.sections.length}, Items: ${totalItems}`);
        console.log('');
        
        processed++;
      } catch (error) {
        console.error(`  ✗ Error processing ${fileName}:`, error.message);
        console.error(`    ${error.stack}`);
        console.log('');
        errors++;
      }
    }
    
    console.log('='.repeat(80));
    console.log('UPDATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total files: ${files.length}`);
    console.log('');
    console.log('✓ Update complete!');
    console.log('');
    console.log('Refresh your browser to see the updated templates in the Checklist Templates page.');
    
  } catch (error) {
    console.error('Update failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateAllTemplates()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateAllTemplates, parseExcelTemplate };
