require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function fixPM008() {
  try {
    const result = await pool.query(
      `SELECT id, template_code, template_name, checklist_structure 
       FROM checklist_templates 
       WHERE template_code = 'PM-008'`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Template PM-008 not found');
      return;
    }
    
    const template = result.rows[0];
    let structure = template.checklist_structure;
    if (typeof structure === 'string') {
      structure = JSON.parse(structure);
    }
    
    // Fix Section 3: Remove duplicate item and fix placeholders
    const section3 = structure.sections.find(s => s.id === 'section_3');
    if (section3) {
      // Remove duplicate item (item_3_8 is duplicate of item_3_5)
      section3.items = section3.items.filter(item => item.id !== 'item_3_8');
      
      // Fix item_3_11: Remove {inspected_by} placeholder or convert to proper field
      const item311 = section3.items.find(item => item.id === 'item_3_11');
      if (item311 && item311.label.includes('{inspected_by}')) {
        // Remove this placeholder item as it's handled by metadata
        section3.items = section3.items.filter(item => item.id !== 'item_3_11');
      }
      
      // Fix item_3_12: Fix typo "Inspecton" -> "Inspection"
      const item312 = section3.items.find(item => item.id === 'item_3_12');
      if (item312) {
        item312.label = item312.label.replace('Inspecton', 'Inspection');
      }
      
      // Re-index items
      section3.items.forEach((item, idx) => {
        item.id = `item_3_${idx + 1}`;
      });
    }
    
    // Ensure metadata has defaults
    if (!structure.metadata) {
      structure.metadata = {};
    }
    structure.metadata.checklist_made_by = structure.metadata.checklist_made_by || 'and';
    structure.metadata.last_revision_approved_by = structure.metadata.last_revision_approved_by || 'Floridas Moloto';
    
    await pool.query(
      `UPDATE checklist_templates 
       SET checklist_structure = $1::jsonb, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [JSON.stringify(structure), template.id]
    );
    
    console.log('✅ Fixed PM-008 template structure:');
    console.log('   - Removed duplicate item (item_3_8)');
    console.log('   - Removed {inspected_by} placeholder item');
    console.log('   - Fixed typo: "Inspecton" -> "Inspection"');
    console.log(`   - Section 3 now has ${section3.items.length} items`);
    
  } catch (error) {
    console.error('Error fixing PM-008:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixPM008();
}

module.exports = { fixPM008 };
