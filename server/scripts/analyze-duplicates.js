require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function analyzeDuplicates() {
  try {
    console.log('🔍 Analyzing Templates for Duplicates\n');
    
    const result = await pool.query(`
      SELECT id, template_code, template_name, asset_type, frequency, created_at
      FROM checklist_templates
      ORDER BY template_code, template_name
    `);
    
    console.log(`Total templates: ${result.rows.length}\n`);
    
    // Group by asset_type and frequency to find potential duplicates
    const grouped = {};
    result.rows.forEach(t => {
      const key = `${t.asset_type}_${t.frequency}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(t);
    });
    
    console.log('Potential Duplicates (same asset_type + frequency):\n');
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length > 1) {
        console.log(`  ${key}:`);
        grouped[key].forEach(t => {
          console.log(`    - ${t.template_code}: ${t.template_name}`);
        });
        console.log('');
      }
    });
    
    // Check Energy Meter specifically
    console.log('Energy Meter Templates:\n');
    const energyMeters = result.rows.filter(t => t.asset_type === 'energy_meter');
    energyMeters.forEach(t => {
      console.log(`  ${t.template_code}: ${t.template_name} (${t.frequency})`);
      console.log(`    Created: ${t.created_at}`);
    });
    
    console.log('\n✅ Analysis Complete\n');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  analyzeDuplicates();
}

module.exports = { analyzeDuplicates };
