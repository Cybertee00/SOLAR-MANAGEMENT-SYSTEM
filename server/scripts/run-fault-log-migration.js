/**
 * Simple script to run the fault log migration
 * Usage: node run-fault-log-migration.js
 * 
 * This script will read database credentials from:
 * 1. Command line arguments (--user=, --password=, etc.)
 * 2. Environment variables (DB_USER, DB_PASSWORD, etc.)
 * 3. .env file in the server directory
 * 4. Default values (localhost, postgres, etc.)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    options[key] = value;
  }
});

const pool = new Pool({
  host: options.host || process.env.DB_HOST || 'localhost',
  port: options.port || process.env.DB_PORT || 5432,
  database: options.database || process.env.DB_NAME || 'solar_om_db',
  user: options.user || process.env.DB_USER || 'postgres',
  password: options.password || process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  try {
    const migrationFile = 'add_fault_log_fields_to_cm_letters.sql';
    const migrationPath = path.join(__dirname, '../db/migrations', migrationFile);
    
    console.log('\n📊 Database Configuration:');
    console.log(`   Host: ${pool.options.host}`);
    console.log(`   Port: ${pool.options.port}`);
    console.log(`   Database: ${pool.options.database}`);
    console.log(`   User: ${pool.options.user}`);
    console.log(`   Password: ${pool.options.password ? '***' : 'N/A'}\n`);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migration = fs.readFileSync(migrationPath, 'utf8');
    console.log(`🔄 Running migration: ${migrationFile}\n`);
    
    // Test connection first
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    // Run migration
    await pool.query(migration);
    
    console.log('✅ Migration applied successfully!\n');
    console.log('📝 The following columns have been added to cm_letters table:');
    console.log('   - reported_by (UUID)');
    console.log('   - plant (VARCHAR, default: Witkop)');
    console.log('   - fault_description (VARCHAR)');
    console.log('   - affected_plant_functionality (VARCHAR)');
    console.log('   - main_affected_item (VARCHAR)');
    console.log('   - production_affected (VARCHAR)');
    console.log('   - affected_item_line (VARCHAR)');
    console.log('   - affected_item_cabinet (INTEGER)');
    console.log('   - affected_item_inverter (VARCHAR)');
    console.log('   - affected_item_comb_box (VARCHAR)');
    console.log('   - affected_item_bb_tracker (VARCHAR)');
    console.log('   - code_error (VARCHAR)');
    console.log('   - failure_cause (TEXT)');
    console.log('   - action_taken (TEXT)\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error applying migration:', error.message);
    if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Please check your database credentials.');
      console.error('   You can provide credentials via:');
      console.error('   - Command line: node run-fault-log-migration.js --user=youruser --password=yourpass');
      console.error('   - Environment variables: DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME');
      console.error('   - .env file in the server directory\n');
    } else if (error.code === '3D000') {
      console.error('\n💡 Database does not exist. Please create it first.\n');
    } else {
      console.error('\n💡 Full error:', error);
    }
    await pool.end();
    process.exit(1);
  }
}

runMigration();
