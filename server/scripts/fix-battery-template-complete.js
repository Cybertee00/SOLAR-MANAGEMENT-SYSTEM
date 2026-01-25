require('dotenv').config();
const ExcelJS = require('exceljs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

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

async function parseBatteryTemplateComplete() {
  const filePath = path.join(__dirname, '../templates/excel/SUBSTATION-BATTERIES.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  console.log('🔋 Parsing Battery Template (PM-021) - Complete Structure\n');
  
  // Find Battery Bank headers (row 11)
  const batteryBanks = [];
  const headerRow = 11;
  const headerRowData = worksheet.getRow(headerRow);
  
  headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = getCellText(cell.value);
    if (text.toLowerCase().includes('battery bank')) {
      batteryBanks.push({
        col: colNumber,
        title: text.trim()
      });
    }
  });
  
  console.log(`Found ${batteryBanks.length} Battery Bank(s):`);
  batteryBanks.forEach((bank, idx) => {
    console.log(`  ${idx + 1}. ${bank.title} at column ${bank.col}`);
  });
  console.log('');
  
  const sections = [];
  const startRow = 14; // Data starts at row 14 (after Battery Bank row 11, empty row 12, No./Value row 13)
  
  // Parse each Battery Bank
  for (const bank of batteryBanks) {
    const section = {
      id: `section_${sections.length + 1}`,
      title: bank.title,
      items: []
    };
    
    console.log(`\n📋 Parsing ${bank.title}:`);
    
    // Each Battery Bank has 2 column groups:
    // Group 1: Column bank.col (Cell 1-43), Column bank.col+1 ({value})
    // Group 2: Column bank.col+2 (Cell 44-86), Column bank.col+3 ({value})
    const columnGroups = [
      { cellCol: bank.col, valueCol: bank.col + 1, startCell: 1, endCell: 43 },
      { cellCol: bank.col + 2, valueCol: bank.col + 3, startCell: 44, endCell: 86 }
    ];
    
    // Parse all rows
    for (let r = startRow; r <= Math.min(worksheet.rowCount, startRow + 100); r++) {
      const row = worksheet.getRow(r);
      
      // Check each column group
      for (const group of columnGroups) {
        const cellCell = row.getCell(group.cellCol);
        const valueCell = row.getCell(group.valueCol);
        const cellText = getCellText(cellCell.value);
        const valueText = getCellText(valueCell.value);
        
        // Check if this is a "Cell X" row
        const cellMatch = cellText.match(/cell\s*(\d+)/i);
        if (cellMatch) {
          const cellNumber = parseInt(cellMatch[1]);
          
          // Check if {value} is present
          const hasValue = /\{value\}/i.test(valueText);
          
          const item = {
            id: `item_${section.id}_${section.items.length + 1}`,
            label: `Cell ${cellNumber}`,
            type: hasValue ? 'pass_fail_with_measurement' : 'pass_fail',
            required: true
          };
          
          if (hasValue) {
            item.measurement_fields = [{
              id: 'value_1',
              label: `Cell ${cellNumber} (V)`,
              type: 'number',
              unit: 'V',
              required: true
            }];
          }
          
          section.items.push(item);
        }
      }
    }
    
    // Sort items by cell number
    section.items.sort((a, b) => {
      const aNum = parseInt(a.label.match(/\d+/)?.[0] || '0');
      const bNum = parseInt(b.label.match(/\d+/)?.[0] || '0');
      return aNum - bNum;
    });
    
    console.log(`  ✅ Created ${section.items.length} items`);
    sections.push(section);
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`  Sections: ${sections.length}`);
  sections.forEach((s, idx) => {
    console.log(`    Section ${idx + 1}: ${s.title} - ${s.items.length} items`);
    const withMeasurements = s.items.filter(i => i.measurement_fields && i.measurement_fields.length > 0).length;
    console.log(`      Items with measurement fields: ${withMeasurements}`);
  });
  
  // Update database
  const structure = {
    sections: sections,
    metadata: {
      procedure: '021',
      plant: 'WITKOP SOLAR PLANT',
      checklist_made_by: 'and',
      last_revision_approved_by: 'Floridas Moloto'
    }
  };
  
  const result = await pool.query(`
    UPDATE checklist_templates
    SET checklist_structure = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE template_code = 'PM-021'
    RETURNING id, template_code, template_name
  `, [JSON.stringify(structure)]);
  
  if (result.rows.length > 0) {
    console.log(`\n✅ Updated PM-021 in database`);
    console.log(`   Template: ${result.rows[0].template_name}`);
  } else {
    console.log(`\n❌ PM-021 not found in database`);
  }
  
  await pool.end();
}

parseBatteryTemplateComplete().catch(console.error);
