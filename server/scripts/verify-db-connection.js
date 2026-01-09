require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function verifyConnection() {
  try {
    console.log('Verifying database connection...');
    console.log('Database:', process.env.DB_NAME || 'solar_om_db');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('Port:', process.env.DB_PORT || 5432);
    
    // Test connection
    const testResult = await pool.query('SELECT current_database() as db_name, version() as pg_version');
    console.log('\n✓ Connected to database:', testResult.rows[0].db_name);
    
    // Check if spare_requests table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'spare_requests'
      ) as exists
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✓ spare_requests table exists');
      
      // Count rows
      const countResult = await pool.query('SELECT COUNT(*) as count FROM spare_requests');
      console.log(`  - Total spare requests: ${countResult.rows[0].count}`);
    } else {
      console.log('✗ spare_requests table does NOT exist');
      console.log('\nRunning migration...');
      
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, '../db/migrations/add_role_system_and_spare_requests.sql');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(migration);
      console.log('✓ Migration applied successfully!');
    }
    
    await pool.end();
    console.log('\n✓ Database connection verified successfully!');
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Full error:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyConnection();
