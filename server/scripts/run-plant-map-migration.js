require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'checksheets_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigration() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../db/migrations/create_plant_map_structure.sql'),
      'utf8'
    );
    await pool.query(sql);
    console.log('✓ Plant map structure table migration completed successfully');
    await pool.end();
  } catch (err) {
    console.error('Migration error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
