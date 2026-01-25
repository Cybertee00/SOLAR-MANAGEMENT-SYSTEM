require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function fixTrackerPM005() {
  try {
    // Check if TRACKER-PM-005 exists
    const check = await pool.query(
      `SELECT id, template_code, template_name FROM checklist_templates WHERE template_code = 'TRACKER-PM-005'`
    );
    
    if (check.rows.length === 0) {
      console.log('✅ TRACKER-PM-005 already updated or not found');
      return;
    }
    
    // Check if PM-023 is available
    const pm023Check = await pool.query(
      `SELECT id FROM checklist_templates WHERE template_code = 'PM-023'`
    );
    
    if (pm023Check.rows.length > 0) {
      console.log('⚠️  PM-023 already exists, trying PM-024...');
      const pm024Check = await pool.query(
        `SELECT id FROM checklist_templates WHERE template_code = 'PM-024'`
      );
      if (pm024Check.rows.length > 0) {
        console.log('❌ Both PM-023 and PM-024 are taken. Please assign manually.');
        return;
      }
      // Use PM-024
      await pool.query(
        `UPDATE checklist_templates SET template_code = 'PM-024', updated_at = CURRENT_TIMESTAMP WHERE template_code = 'TRACKER-PM-005'`
      );
      console.log('✅ TRACKER-PM-005 -> PM-024');
    } else {
      // Use PM-023
      await pool.query(
        `UPDATE checklist_templates SET template_code = 'PM-023', updated_at = CURRENT_TIMESTAMP WHERE template_code = 'TRACKER-PM-005'`
      );
      console.log('✅ TRACKER-PM-005 -> PM-023');
    }
    
    // Verify
    const verify = await pool.query(
      `SELECT template_code, template_name FROM checklist_templates WHERE id = $1`,
      [check.rows[0].id]
    );
    console.log(`   Template: ${verify.rows[0].template_code} - ${verify.rows[0].template_name}`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixTrackerPM005();
}

module.exports = { fixTrackerPM005 };
