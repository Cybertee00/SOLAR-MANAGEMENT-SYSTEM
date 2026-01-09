require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  try {
    // Get migration file name from command line argument
    const migrationFileName = process.argv[2] || 'add_role_system_and_spare_requests.sql';
    
    console.log(`Running migration: ${migrationFileName}`);
    
    const migrationPath = path.join(__dirname, '../db/migrations', migrationFileName);
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migration = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migration);
    console.log(`Migration ${migrationFileName} applied successfully!`);
    
    await pool.end();
  } catch (error) {
    console.error('Error running migration:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

