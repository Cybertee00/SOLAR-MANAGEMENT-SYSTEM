require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function removeDuplicate() {
  try {
    console.log('🔍 Checking for duplicate Energy Meter template...\n');
    
    // Get both Energy Meter templates
    const energyMeters = await pool.query(`
      SELECT id, template_code, template_name, 
             (SELECT COUNT(*) FROM tasks WHERE checklist_template_id = checklist_templates.id) as task_count,
             created_at
      FROM checklist_templates
      WHERE asset_type = 'energy_meter'
      ORDER BY created_at
    `);
    
    if (energyMeters.rows.length < 2) {
      console.log('No duplicates found. Only one Energy Meter template exists.');
      return;
    }
    
    console.log('Found Energy Meter templates:');
    energyMeters.rows.forEach((t, idx) => {
      console.log(`\n${idx + 1}. ${t.template_code} - ${t.template_name}`);
      console.log(`   Created: ${t.created_at.toISOString().split('T')[0]}`);
      console.log(`   Tasks: ${t.task_count}`);
      console.log(`   ID: ${t.id}`);
    });
    
    // Identify the duplicate (one with fewer tasks or created later)
    const template1 = energyMeters.rows[0];
    const template2 = energyMeters.rows[1];
    
    let toDelete = null;
    let toKeep = null;
    
    if (template1.task_count > template2.task_count) {
      toDelete = template2;
      toKeep = template1;
    } else if (template2.task_count > template1.task_count) {
      toDelete = template1;
      toKeep = template2;
    } else {
      // Same task count, delete the newer one
      if (template1.created_at < template2.created_at) {
        toDelete = template2;
        toKeep = template1;
      } else {
        toDelete = template1;
        toKeep = template2;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\nRecommendation:');
    console.log(`  KEEP: ${toKeep.template_code} - ${toKeep.template_name} (${toKeep.task_count} tasks)`);
    console.log(`  DELETE: ${toDelete.template_code} - ${toDelete.template_name} (${toDelete.task_count} tasks)`);
    console.log('\n⚠️  This will permanently delete the template. Continue? (y/n)');
    console.log('   (Run with --confirm flag to skip prompt)');
    
    // Check for --confirm flag
    const args = process.argv.slice(2);
    const confirm = args.includes('--confirm');
    
    if (!confirm) {
      console.log('\nSkipping deletion. Run with --confirm to delete.');
      return;
    }
    
    // Delete the duplicate
    console.log('\n🗑️  Deleting duplicate template...');
    await pool.query('DELETE FROM checklist_templates WHERE id = $1', [toDelete.id]);
    
    console.log(`✅ Deleted: ${toDelete.template_code} - ${toDelete.template_name}`);
    console.log(`✅ Kept: ${toKeep.template_code} - ${toKeep.template_name}`);
    console.log('\n✅ Duplicate removed! Total templates should now be 14.\n');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  removeDuplicate();
}

module.exports = { removeDuplicate };
