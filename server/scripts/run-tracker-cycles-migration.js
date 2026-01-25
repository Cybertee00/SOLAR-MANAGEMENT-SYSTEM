/**
 * Run the tracker cycles migration
 * Creates the tracker_cycles and tracker_cycle_history tables
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'checksheets_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Running tracker cycles migration...');
    
    const migrationPath = path.join(__dirname, '../db/migrations/create_tracker_cycles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('✓ Tracker cycles migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
