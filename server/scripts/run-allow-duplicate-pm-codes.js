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
    console.log('🔄 Running migration: Allow duplicate PM codes\n');
    
    const migrationPath = path.join(__dirname, '../db/migrations/allow_duplicate_pm_codes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...\n');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    console.log('Changes:');
    console.log('  - Removed UNIQUE constraint on template_code');
    console.log('  - Added composite UNIQUE constraint on (template_code, template_name)');
    console.log('  - Added index on template_code for performance\n');
    
  } catch (error) {
    if (error.code === '42P07' || error.message.includes('already exists')) {
      console.log('⚠️  Constraint or index already exists, continuing...\n');
    } else {
      console.error('Error running migration:', error);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
