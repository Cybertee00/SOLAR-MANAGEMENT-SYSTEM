require('dotenv').config();
const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default postgres DB first
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const TARGET_DB = process.env.DB_NAME || 'solar_om_db';
// Backup file is in scripts/database-dump/ from project root
const BACKUP_FILE = path.join(__dirname, '../../scripts/database-dump/solar_om_db_backup.backup');

async function restoreDatabase() {
  const pool = new Pool(DB_CONFIG);
  
  try {
    console.log('🔄 Starting database restoration...\n');
    console.log(`📁 Backup file: ${BACKUP_FILE}`);
    
    // Check if backup file exists
    if (!fs.existsSync(BACKUP_FILE)) {
      throw new Error(`Backup file not found: ${BACKUP_FILE}`);
    }
    
    const fileStats = fs.statSync(BACKUP_FILE);
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

    // Close connection to postgres DB
    await pool.end();

    // Step 4: Restore the backup using pg_restore
    console.log('4️⃣ Restoring backup file...');
    console.log('   This may take a few minutes depending on the backup size...\n');
    
    // Try to find pg_restore in common PostgreSQL installation paths
    const possiblePaths = [
      'pg_restore', // In PATH
      'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_restore.exe',
      'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_restore.exe',
      'C:\\Program Files\\PostgreSQL\\13\\bin\\pg_restore.exe',
      'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe',
    ];
    
    let pgRestorePath = null;
    for (const possiblePath of possiblePaths) {
      try {
        execSync(`"${possiblePath}" --version`, { stdio: 'ignore', shell: true });
        pgRestorePath = possiblePath;
        break;
      } catch (e) {
        // Try next path
      }
    }
    
    if (!pgRestorePath) {
      console.log('   ⚠️  pg_restore not found in PATH or common locations.');
      console.log('   📝 Please run this command manually:');
      console.log(`\n   pg_restore --verbose --clean --no-acl --no-owner -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${TARGET_DB} "${BACKUP_FILE}"\n`);
      console.log('   Or set PGPASSWORD environment variable:');
      console.log(`   $env:PGPASSWORD="${DB_CONFIG.password}"; pg_restore --verbose --clean --no-acl --no-owner -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${TARGET_DB} "${BACKUP_FILE}"\n`);
      console.log('   Waiting for manual restore to complete...');
      console.log('   Press Enter after you have run the restore command...');
      
      // Wait for user input (in Node.js, we can't easily do this, so we'll just exit)
      console.log('\n   ⚠️  Please run the restore command manually, then run this script again to verify.');
      process.exit(0);
    }
    
    const pgRestoreCmd = `"${pgRestorePath}" --verbose --clean --no-acl --no-owner -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${TARGET_DB} "${BACKUP_FILE}"`;
    
    // Set PGPASSWORD environment variable for pg_restore
    process.env.PGPASSWORD = DB_CONFIG.password;
    
    try {
      execSync(pgRestoreCmd, {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          PGPASSWORD: DB_CONFIG.password
        }
      });
      console.log('\n   ✅ Backup restored successfully!\n');
    } catch (error) {
      // pg_restore may exit with code 1 even on success for some warnings
      // Check if database was actually restored
      const checkPool = new Pool({
        ...DB_CONFIG,
        database: TARGET_DB
      });
      try {
        const result = await checkPool.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = \'public\'');
        if (parseInt(result.rows[0].count) > 0) {
          console.log('\n   ✅ Backup restored successfully (some warnings may have occurred)\n');
        } else {
          throw new Error('Database appears to be empty after restore');
        }
        await checkPool.end();
      } catch (checkError) {
        await checkPool.end();
        throw new Error(`Restore failed: ${error.message}`);
      }
    }

    // Step 5: Verify restoration
    console.log('5️⃣ Verifying restoration...');
    const verifyPool = new Pool({
      ...DB_CONFIG,
      database: TARGET_DB
    });
    
    try {
      const tablesResult = await verifyPool.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const usersResult = await verifyPool.query(`
        SELECT COUNT(*) as user_count FROM users
      `);
      
      console.log(`   ✅ Tables found: ${tablesResult.rows[0].table_count}`);
      console.log(`   ✅ Users found: ${usersResult.rows[0].user_count}`);
      console.log('\n✅ Database restoration completed successfully!\n');
      
      await verifyPool.end();
    } catch (error) {
      await verifyPool.end();
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Error restoring database:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

// Run restoration
restoreDatabase();
