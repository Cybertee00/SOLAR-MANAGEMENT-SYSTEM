require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkSchema() {
  try {
    // Check organizations table structure
    const orgCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations'`);
    console.log('Organizations columns:', orgCols.rows.map(r => r.column_name).join(', '));
    
    // Check what organization exists
    const orgs = await pool.query('SELECT id, name, slug FROM organizations');
    console.log('Existing organizations:', JSON.stringify(orgs.rows, null, 2));
    
    // Check which tables exist
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('feedback', 'api_tokens', 'webhooks', 'overtime_requests', 'inventory_slips', 'inventory_transactions', 'task_assignments')`);
    console.log('Tables that exist:', tables.rows.map(r => r.table_name).join(', '));
    
    // Check which tables DON'T exist
    const allTables = ['feedback', 'api_tokens', 'webhooks', 'overtime_requests', 'inventory_slips', 'inventory_transactions', 'task_assignments'];
    const existingTables = tables.rows.map(r => r.table_name);
    const missingTables = allTables.filter(t => !existingTables.includes(t));
    console.log('Tables that DON\'T exist:', missingTables.join(', ') || 'none');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}
checkSchema();
