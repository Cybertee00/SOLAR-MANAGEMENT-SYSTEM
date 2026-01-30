/**
 * Fix template assignment - handle duplicates
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

async function fixTemplates() {
  try {
    console.log('🔍 Checking unassigned templates...\n');
    
    // Find unassigned templates
    const unassigned = await pool.query(
      `SELECT id, template_code, template_name, is_system_template, organization_id 
       FROM checklist_templates 
       WHERE organization_id IS NULL`
    );
    
    console.log(`Found ${unassigned.rowCount} unassigned template(s):`);
    unassigned.rows.forEach(row => {
      console.log(`   - ID: ${row.id}`);
      console.log(`     Code: ${row.template_code}`);
      console.log(`     Name: ${row.template_name}`);
      console.log(`     is_system_template: ${row.is_system_template}`);
    });
    
    if (unassigned.rowCount === 0) {
      console.log('\n✅ All templates already assigned!');
      await pool.end();
      return;
    }
    
    // Check for duplicate codes
    console.log('\n🔍 Checking for duplicate template codes...');
    for (const template of unassigned.rows) {
      const duplicate = await pool.query(
        `SELECT id, template_code, organization_id 
         FROM checklist_templates 
         WHERE template_code = $1 AND organization_id = $2`,
        [template.template_code, SMART_INNOVATIONS_ID]
      );
      
      if (duplicate.rowCount > 0) {
        console.log(`   ⚠️  Duplicate found for ${template.template_code}`);
        console.log(`      Existing ID: ${duplicate.rows[0].id}`);
        console.log(`      Unassigned ID: ${template.id}`);
        
        // Delete the unassigned duplicate (the one with NULL organization_id)
        console.log(`   🗑️  Deleting unassigned duplicate...`);
        await pool.query('DELETE FROM checklist_templates WHERE id = $1', [template.id]);
        console.log(`   ✅ Deleted template ID: ${template.id}`);
      } else {
        // No duplicate, safe to assign
        console.log(`   ✅ No duplicate for ${template.template_code}, assigning...`);
        await pool.query(
          `UPDATE checklist_templates 
           SET organization_id = $1, is_system_template = false 
           WHERE id = $2`,
          [SMART_INNOVATIONS_ID, template.id]
        );
      }
    }
    
    // Verify final state
    const check = await pool.query(
      `SELECT COUNT(*) as total, 
              COUNT(organization_id) as assigned,
              COUNT(*) FILTER (WHERE organization_id IS NULL) as unassigned
       FROM checklist_templates`
    );
    
    console.log(`\n📊 Final Template Status:`);
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

fixTemplates();
