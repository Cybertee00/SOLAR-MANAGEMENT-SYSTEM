const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../db/migrations/create_tracker_status_requests.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✓ Migration completed: Created tracker_status_requests table');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
