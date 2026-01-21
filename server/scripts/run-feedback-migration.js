/**
 * Run Feedback Migration Only
 * Alternative script to run just the feedback table migration
 * Usage: node run-feedback-migration.js [--password=your_password]
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse command line arguments for password override
const args = process.argv.slice(2);
const passwordArg = args.find(arg => arg.startsWith('--password='));

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: passwordArg ? passwordArg.split('=')[1] : (process.env.DB_PASSWORD || 'postgres'),
};

console.log('Running Feedback Migration...');
console.log(`  Host: ${config.host}`);
console.log(`  Port: ${config.port}`);
console.log(`  Database: ${config.database}`);
console.log(`  User: ${config.user}`);
console.log('');

const pool = new Pool(config);

async function runFeedbackMigration() {
  try {
    // Test connection first
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Read and run the migration
    const migrationPath = path.join(__dirname, '../db/migrations/add_feedback_table.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration: add_feedback_table.sql');
    await pool.query(migration);
    
    console.log('✅ Feedback table created successfully!');
    console.log('\nYou can now use the feedback widget in the application.');
    
    // Verify the table was created
    const verifyResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'feedback_submissions'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Table verification: feedback_submissions table exists');
    } else {
      console.log('⚠️  Warning: Table verification failed');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    if (error.code === '28P01') {
      console.error('\n❌ DATABASE AUTHENTICATION ERROR');
      console.error('Password authentication failed for user "' + config.user + '"');
      console.error('\nTo fix this:');
      console.error('1. Update your .env file with the correct DB_PASSWORD');
      console.error('2. Or run with password: node run-feedback-migration.js --password=your_password');
      console.error('3. Or connect to PostgreSQL and run the migration manually');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ DATABASE CONNECTION ERROR');
      console.error('Cannot connect to database. Is PostgreSQL running?');
      console.error(`Tried connecting to: ${config.host}:${config.port}`);
    } else if (error.code === '3D000') {
      console.error('\n❌ DATABASE NOT FOUND');
      console.error(`Database "${config.database}" does not exist.`);
      console.error('Please create the database first or update DB_NAME in .env');
    } else if (error.code === '42P07') {
      console.log('⚠️  Table already exists. This is OK - migration is idempotent.');
      console.log('✅ Feedback table is ready to use.');
      await pool.end();
      process.exit(0);
    } else {
      console.error('\n❌ Error running migration:', error.message);
      console.error('Error code:', error.code);
    }
    
    await pool.end();
    process.exit(1);
  }
}

runFeedbackMigration();
