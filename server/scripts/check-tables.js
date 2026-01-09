require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_maintenance',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkTables() {
  try {
    console.log('Checking database:', process.env.DB_NAME || 'solar_maintenance');
    
    // Check if tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('spare_requests', 'spare_request_items', 'tasks', 'users')
      ORDER BY table_name
    `);
    
    console.log('\nTables found:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    if (result.rows.length === 0) {
      console.log('\nNo tables found. Database might be empty.');
    }
    
    // Check if spare_requests exists specifically
    const spareRequestsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'spare_requests'
      )
    `);
    
    if (spareRequestsCheck.rows[0].exists) {
      console.log('\n✓ spare_requests table exists');
      
      // Check columns
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'spare_requests'
        ORDER BY ordinal_position
      `);
      console.log('\nColumns in spare_requests:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('\n✗ spare_requests table does NOT exist');
      console.log('\nRunning migration...');
      
      // Run migration
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, '../db/migrations/add_role_system_and_spare_requests.sql');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(migration);
      console.log('✓ Migration applied successfully!');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkTables();
