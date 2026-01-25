require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function updateCCTVTemplates() {
  try {
    console.log('🔧 Updating CCTV Templates to PM-XXX format\n');
    
    // Find CCTV templates
    const cctvTemplates = await pool.query(`
      SELECT id, template_code, template_name, frequency
      FROM checklist_templates
      WHERE template_code LIKE 'CCTV%' OR asset_type = 'cctv'
      ORDER BY frequency
    `);
    
    if (cctvTemplates.rows.length === 0) {
      console.log('No CCTV templates found');
      return;
    }
    
    console.log(`Found ${cctvTemplates.rows.length} CCTV templates:\n`);
    
    // Determine PM number - use a consistent number for both (e.g., PM-001)
    // They'll be differentiated by template name
    const pmNumber = 'PM-001';
    
    for (const template of cctvTemplates.rows) {
      const newCode = pmNumber;
      const oldCode = template.template_code;
      
      console.log(`  ${oldCode} -> ${newCode}`);
      console.log(`    Template: ${template.template_name}`);
      console.log(`    Frequency: ${template.frequency}\n`);
      
      // Check if this combination already exists
      const existing = await pool.query(
        `SELECT id FROM checklist_templates 
         WHERE template_code = $1 AND template_name = $2 AND id != $3`,
        [newCode, template.template_name, template.id]
      );
      
      if (existing.rows.length > 0) {
        console.log(`    ⚠️  Warning: ${newCode} + "${template.template_name}" already exists, skipping...\n`);
        continue;
      }
      
      // Update template code
      await pool.query(
        `UPDATE checklist_templates 
         SET template_code = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newCode, template.id]
      );
      
      console.log(`    ✅ Updated successfully\n`);
    }
    
    console.log('✅ CCTV templates updated!\n');
    
    // Show final state
    const final = await pool.query(`
      SELECT template_code, template_name, frequency
      FROM checklist_templates
      WHERE asset_type = 'cctv'
      ORDER BY frequency
    `);
    
    console.log('Final CCTV templates:');
    final.rows.forEach(t => {
      console.log(`  ${t.template_code} - ${t.template_name} (${t.frequency})`);
    });
    
  } catch (error) {
    console.error('Error updating CCTV templates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateCCTVTemplates();
}

module.exports = { updateCCTVTemplates };
