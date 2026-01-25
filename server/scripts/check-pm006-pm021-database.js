require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkTemplates() {
  try {
    console.log('='.repeat(100));
    console.log('📊 CHECKING PM-006 AND PM-021 IN DATABASE');
    console.log('='.repeat(100));
    
    // Get PM-006
    const pm006 = await pool.query(`
      SELECT id, template_code, template_name, 
             checklist_structure::text as structure_json
      FROM checklist_templates
      WHERE template_code = 'PM-006'
    `);
    
    if (pm006.rows.length > 0) {
      const template = pm006.rows[0];
      const structure = JSON.parse(template.structure_json);
      
      console.log('\n📋 PM-006: Monthly Inspection for CT building Inverters\n');
      console.log(`Template Code: ${template.template_code}`);
      console.log(`Template Name: ${template.template_name}`);
      console.log(`Sections: ${structure.sections?.length || 0}\n`);
      
      if (structure.sections && structure.sections.length > 0) {
        structure.sections.forEach((section, idx) => {
          console.log(`Section ${idx + 1}: ${section.title}`);
          console.log(`  Items: ${section.items?.length || 0}\n`);
          
          if (section.items && section.items.length > 0) {
            section.items.forEach((item, itemIdx) => {
              console.log(`  ${itemIdx + 1}. ${item.label}`);
              console.log(`     Type: ${item.type}`);
              if (item.measurement_fields && item.measurement_fields.length > 0) {
                console.log(`     Measurement Fields: ${item.measurement_fields.length}`);
                item.measurement_fields.forEach((mf, mfIdx) => {
                  console.log(`       ${mfIdx + 1}. ${mf.label} (${mf.unit || 'no unit'})`);
                });
              } else {
                console.log(`     Measurement Fields: NONE ❌`);
              }
              console.log('');
            });
          }
        });
      } else {
        console.log('❌ No sections found!\n');
      }
    } else {
      console.log('❌ PM-006 not found in database\n');
    }
    
    // Get PM-021
    const pm021 = await pool.query(`
      SELECT id, template_code, template_name, 
             checklist_structure::text as structure_json
      FROM checklist_templates
      WHERE template_code = 'PM-021'
    `);
    
    if (pm021.rows.length > 0) {
      const template = pm021.rows[0];
      const structure = JSON.parse(template.structure_json);
      
      console.log('\n\n' + '='.repeat(100));
      console.log('📋 PM-021: Monthly Inspection for Substation BTU\n');
      console.log(`Template Code: ${template.template_code}`);
      console.log(`Template Name: ${template.template_name}`);
      console.log(`Sections: ${structure.sections?.length || 0}\n`);
      
      if (structure.sections && structure.sections.length > 0) {
        structure.sections.forEach((section, idx) => {
          console.log(`Section ${idx + 1}: ${section.title}`);
          console.log(`  Items: ${section.items?.length || 0}\n`);
          
          if (section.items && section.items.length > 0) {
            // Show first 5 and last 5 items
            const itemsToShow = section.items.length > 10 
              ? [...section.items.slice(0, 5), ...section.items.slice(-5)]
              : section.items;
            
            itemsToShow.forEach((item, itemIdx) => {
              const actualIdx = section.items.length > 10 && itemIdx >= 5 
                ? section.items.length - 5 + itemIdx
                : itemIdx;
              console.log(`  ${actualIdx + 1}. ${item.label}`);
              console.log(`     Type: ${item.type}`);
              if (item.measurement_fields && item.measurement_fields.length > 0) {
                console.log(`     Measurement Fields: ${item.measurement_fields.length}`);
                item.measurement_fields.forEach((mf, mfIdx) => {
                  console.log(`       ${mfIdx + 1}. ${mf.label} (${mf.unit || 'no unit'})`);
                });
              } else {
                console.log(`     Measurement Fields: NONE ❌`);
              }
              if (section.items.length > 10 && itemIdx === 4) {
                console.log(`  ... (${section.items.length - 10} more items) ...`);
              }
              console.log('');
            });
          }
        });
      } else {
        console.log('❌ No sections found!\n');
      }
    } else {
      console.log('❌ PM-021 not found in database\n');
    }
    
    console.log('='.repeat(100));
    console.log('\n✅ Check Complete\n');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkTemplates();
}

module.exports = { checkTemplates };
