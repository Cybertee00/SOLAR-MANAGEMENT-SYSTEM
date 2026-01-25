require('dotenv').config();
const { Pool } = require('pg');
const { parseExcelFile } = require('../utils/templateParser');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function reparseTemplate(templateCode, excelFileName, assetType) {
  try {
    console.log(`\n🔄 Re-parsing ${templateCode} from ${excelFileName}\n`);
    
    const excelPath = path.join(__dirname, '../templates/excel', excelFileName);
    
    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Excel file not found: ${excelPath}`);
      return false;
    }
    
    // Parse the Excel file
    console.log('📄 Parsing Excel file...');
    const parsed = await parseExcelFile(excelPath, assetType, 'TEST', excelFileName);
    
    console.log(`✅ Parsed successfully:`);
    console.log(`   Template Code: ${parsed.template_code}`);
    console.log(`   Template Name: ${parsed.template_name}`);
    console.log(`   Sections: ${parsed.checklist_structure.sections.length}`);
    
    let totalItems = 0;
    let itemsWithMeasurements = 0;
    
    parsed.checklist_structure.sections.forEach((section, idx) => {
      console.log(`\n   Section ${idx + 1}: ${section.title}`);
      console.log(`     Items: ${section.items.length}`);
      totalItems += section.items.length;
      
      section.items.forEach((item, itemIdx) => {
        if (item.measurement_fields && item.measurement_fields.length > 0) {
          itemsWithMeasurements++;
          console.log(`       ${itemIdx + 1}. ${item.label} - ${item.type} (${item.measurement_fields.length} measurement field(s))`);
        }
      });
    });
    
    console.log(`\n   Total Items: ${totalItems}`);
    console.log(`   Items with Measurement Fields: ${itemsWithMeasurements}`);
    
    // Update database
    const result = await pool.query(`
      UPDATE checklist_templates
      SET checklist_structure = $1,
          template_name = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE template_code = $3
      RETURNING id
    `, [
      JSON.stringify(parsed.checklist_structure),
      parsed.template_name,
      templateCode
    ]);
    
    if (result.rows.length > 0) {
      console.log(`\n✅ Updated ${templateCode} in database`);
      return true;
    } else {
      console.log(`\n❌ Template ${templateCode} not found in database`);
      return false;
    }
    
  } catch (error) {
    console.error(`\n❌ Error re-parsing ${templateCode}:`, error.message);
    console.error(error.stack);
    return false;
  }
}

async function testBackwardCompatibility() {
  console.log('\n\n' + '='.repeat(100));
  console.log('🧪 TESTING BACKWARD COMPATIBILITY');
  console.log('='.repeat(100));
  
  // Test a few other templates to ensure they still work
  const testTemplates = [
    { code: 'PM-004', file: 'Concentrated-Cabinet.xlsx', assetType: 'concentrated_cabinet' },
    { code: 'PM-008', file: 'CT-MV.xlsx', assetType: 'ct_mv' },
    { code: 'PM-009', file: 'Ventilation.xlsx', assetType: 'ventilation' }
  ];
  
  for (const template of testTemplates) {
    try {
      const excelPath = path.join(__dirname, '../templates/excel', template.file);
      if (!fs.existsSync(excelPath)) {
        console.log(`\n⚠️  ${template.code}: File not found, skipping`);
        continue;
      }
      
      console.log(`\n📄 Testing ${template.code} (${template.file})...`);
      const parsed = await parseExcelFile(excelPath, template.assetType, 'TEST', template.file);
      
      if (parsed.checklist_structure.sections.length > 0) {
        const totalItems = parsed.checklist_structure.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
        console.log(`   ✅ OK: ${parsed.checklist_structure.sections.length} sections, ${totalItems} items`);
      } else {
        console.log(`   ⚠️  WARNING: No sections found`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
}

async function main() {
  try {
    console.log('='.repeat(100));
    console.log('🔄 RE-PARSING PM-006 AND PM-021 WITH IMPROVED PARSER');
    console.log('='.repeat(100));
    
    // Re-parse PM-006
    const pm006Success = await reparseTemplate('PM-006', 'Inverters.xlsx', 'inverter');
    
    // Re-parse PM-021
    const pm021Success = await reparseTemplate('PM-021', 'SUBSTATION-BATTERIES.xlsx', 'substation');
    
    // Test backward compatibility
    await testBackwardCompatibility();
    
    console.log('\n\n' + '='.repeat(100));
    if (pm006Success && pm021Success) {
      console.log('✅ RE-PARSING COMPLETE');
      console.log('   - PM-006: Updated with measurement fields for Volts and Amps');
      console.log('   - PM-021: Updated with Battery Bank sections and cell items');
    } else {
      console.log('⚠️  RE-PARSING COMPLETE WITH WARNINGS');
      if (!pm006Success) console.log('   - PM-006: Failed to update');
      if (!pm021Success) console.log('   - PM-021: Failed to update');
    }
    console.log('='.repeat(100));
    console.log('\n');
    
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { reparseTemplate };
