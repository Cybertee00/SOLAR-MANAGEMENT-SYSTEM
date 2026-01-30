/**
 * Assign all templates to Smart Innovations Energy
 * No system templates - each company has its own templates
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const SMART_INNOVATIONS_ID = '00000000-0000-0000-0000-000000000001';

async function assignAllTemplates() {
  try {
    console.log('🔧 Assigning all templates to Smart Innovations Energy...\n');
    
    // Assign ALL templates to Smart Innovations Energy (no system templates)
    const result = await pool.query(
      `UPDATE checklist_templates 
       SET organization_id = $1, is_system_template = false 
       WHERE organization_id IS NULL 
       RETURNING template_code, template_name`,
      [SMART_INNOVATIONS_ID]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ Updated ${result.rowCount} template(s):`);
      result.rows.forEach(row => console.log(`   - ${row.template_code}: ${row.template_name}`));
    } else {
      console.log('✅ All templates already assigned');
    }
    
    // Verify all templates are assigned
    const check = await pool.query(
      `SELECT COUNT(*) as total, 
              COUNT(organization_id) as assigned,
              COUNT(*) FILTER (WHERE organization_id IS NULL) as unassigned
       FROM checklist_templates`
    );
    
    console.log(`\n📊 Template Status:`);
    console.log(`   Total: ${check.rows[0].total}`);
    console.log(`   Assigned: ${check.rows[0].assigned}`);
    console.log(`   Unassigned: ${check.rows[0].unassigned}`);
    
    await pool.end();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

assignAllTemplates();
