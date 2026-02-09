const path = require('path');
const fs = require('fs');

// Load .env from server directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default postgres DB first
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const TARGET_DB = process.env.DB_NAME || 'solar_om_db';
// Try multiple possible paths for the backup file
const BACKUP_PATHS = [
  path.join(__dirname, '../../scripts/database-dump/solar_om_db_backup.backup'),
  path.join(__dirname, '../scripts/database-dump/solar_om_db_backup.backup'),
  'scripts/database-dump/solar_om_db_backup.backup',
];

async function prepareDatabase() {
  const pool = new Pool(DB_CONFIG);
  
  try {
    console.log('🔄 Preparing database for restoration...\n');

    // Find backup file
    let BACKUP_FILE = null;
    for (const backupPath of BACKUP_PATHS) {
      if (fs.existsSync(backupPath)) {
        BACKUP_FILE = path.resolve(backupPath);
        break;
      }
    }

    if (!BACKUP_FILE) {
      console.log('❌ Backup file not found. Searched in:');
      BACKUP_PATHS.forEach(p => console.log(`   - ${p}`));
      console.log('\nPlease ensure the backup file exists in one of these locations.');
      await pool.end();
      process.exit(1);
    }

    const fileStats = fs.statSync(BACKUP_FILE);
    console.log(`📁 Backup file found: ${BACKUP_FILE}`);
    console.log(`📊 Backup file size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB\n`);

    // Step 1: Terminate all connections to the target database
    console.log('1️⃣ Terminating existing connections to database...');
    try {
      await pool.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [TARGET_DB]);
      console.log('   ✅ Connections terminated\n');
    } catch (error) {
      console.log(`   ⚠️  Warning: ${error.message}\n`);
    }

    // Step 2: Drop the existing database
    console.log('2️⃣ Dropping existing database...');
    try {
      await pool.query(`DROP DATABASE IF EXISTS "${TARGET_DB}"`);
      console.log(`   ✅ Database '${TARGET_DB}' dropped\n`);
    } catch (error) {
      console.log(`   ⚠️  Warning: ${error.message}\n`);
    }

    // Step 3: Create a new empty database
    console.log('3️⃣ Creating new database...');
    await pool.query(`CREATE DATABASE "${TARGET_DB}"`);
    console.log(`   ✅ Database '${TARGET_DB}' created\n`);

    await pool.end();

    // Step 4: Provide instructions for manual restore
    console.log('4️⃣ Database prepared! Now restore the backup manually:\n');
    console.log('═'.repeat(80));
    console.log('📝 MANUAL RESTORE INSTRUCTIONS:');
    console.log('═'.repeat(80));
    console.log('\nOption 1: Using pg_restore (if PostgreSQL bin is in PATH):\n');
    console.log(`   $env:PGPASSWORD="${DB_CONFIG.password}"; pg_restore --verbose --clean --no-acl --no-owner -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${TARGET_DB} "${BACKUP_FILE}"\n`);
    
    console.log('Option 2: Using pg_restore with full path (if PostgreSQL is installed):\n');
    console.log(`   $env:PGPASSWORD="${DB_CONFIG.password}"; "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_restore.exe" --verbose --clean --no-acl --no-owner -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${TARGET_DB} "${BACKUP_FILE}"\n`);
    console.log('   (Replace "15" with your PostgreSQL version number)\n');
    
    console.log('Option 3: Using pgAdmin or another PostgreSQL GUI tool:\n');
    console.log('   1. Open pgAdmin');
    console.log(`   2. Right-click on database '${TARGET_DB}'`);
    console.log('   3. Select "Restore..."');
    console.log('   4. Choose "Custom or tar" format');
    console.log(`   5. Select file: ${BACKUP_FILE}`);
    console.log('   6. Click "Restore"\n');
    
    console.log('═'.repeat(80));
    console.log('\nAfter restoring, run this script again with --verify flag to check the restore:');
    console.log('   node scripts/restore-database-manual.js --verify\n');

  } catch (error) {
    console.error('\n❌ Error preparing database:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

async function verifyRestore() {
  const pool = new Pool({
    ...DB_CONFIG,
    database: TARGET_DB
  });
  
  try {
    console.log('🔍 Verifying database restoration...\n');
    
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const usersResult = await pool.query(`
      SELECT COUNT(*) as user_count FROM users
    `);
    
    const orgsResult = await pool.query(`
      SELECT COUNT(*) as org_count FROM organizations
    `);
    
    console.log(`✅ Tables found: ${tablesResult.rows[0].table_count}`);
    console.log(`✅ Users found: ${usersResult.rows[0].user_count}`);
    console.log(`✅ Organizations found: ${orgsResult.rows[0].org_count}`);
    
    if (parseInt(tablesResult.rows[0].table_count) > 0) {
      console.log('\n✅ Database restoration verified successfully!\n');
    } else {
      console.log('\n⚠️  Database appears to be empty. Restore may not have completed.\n');
    }
    
    await pool.end();
  } catch (error) {
    console.error('\n❌ Error verifying database:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--verify')) {
  verifyRestore();
} else {
  prepareDatabase();
}
