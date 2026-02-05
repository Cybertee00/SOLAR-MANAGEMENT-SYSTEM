/**
 * Database Restore Script
 * 
 * Restores a PostgreSQL dump file to the solar_om_db database.
 * 
 * Usage:
 *   node scripts/restore-database.js <dump-file-path>
 * 
 * Example:
 *   node scripts/restore-database.js database-dump/solar_om_db_2025-02-05_12-30-45.backup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read .env file manually
function loadEnv() {
  const envPath = path.join(__dirname, '../server/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

loadEnv();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'solar_om_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// Get dump file path from command line argument
const dumpFile = process.argv[2];

if (!dumpFile) {
  console.error('Error: Please provide the dump file path');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/restore-database.js <dump-file-path>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/restore-database.js database-dump/solar_om_db_2025-02-05_12-30-45.backup');
  process.exit(1);
}

// Check if dump file exists
if (!fs.existsSync(dumpFile)) {
  console.error(`Error: Dump file not found: ${dumpFile}`);
  process.exit(1);
}

console.log('Restoring database from dump...');
console.log(`Dump file: ${dumpFile}`);
console.log(`Database: ${DB_NAME}`);
console.log(`Host: ${DB_HOST}:${DB_PORT}`);
console.log(`User: ${DB_USER}`);
console.log('');
console.log('⚠️  WARNING: This will replace all data in the database!');
console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
console.log('');

// Wait 5 seconds before proceeding
setTimeout(() => {
  restoreDatabase();
}, 5000);

function restoreDatabase() {
try {
  // Set PGPASSWORD environment variable for pg_restore
  const env = {
    ...process.env,
    PGPASSWORD: DB_PASSWORD
  };

  // First, drop and recreate the database to ensure clean restore
  console.log('Dropping existing database (if exists)...');
  try {
    execSync(`psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d postgres -c "DROP DATABASE IF EXISTS \\"${DB_NAME}\\";"`, {
      env: env,
      stdio: 'inherit',
      shell: true
    });
  } catch (error) {
    // Ignore errors if database doesn't exist
  }

  console.log(`Creating database ${DB_NAME}...`);
  execSync(`psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d postgres -c "CREATE DATABASE \\"${DB_NAME}\\";"`, {
    env: env,
    stdio: 'inherit',
    shell: true
  });

  console.log('Restoring data from dump file...');
  // Run pg_restore
  // -c = clean (drop objects before recreating)
  // -d = database name
  const command = `pg_restore -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "${dumpFile}"`;
  
  execSync(command, {
    env: env,
    stdio: 'inherit',
    shell: true
  });

  console.log('');
  console.log('✓ Database restored successfully!');
  console.log(`  Database: ${DB_NAME}`);
  console.log('');
  console.log('You can now start the application with: npm run dev');
  
} catch (error) {
  console.error('');
  console.error('✗ Error restoring database:');
  console.error(error.message);
  console.error('');
  console.error('Make sure:');
  console.error('  1. PostgreSQL is running');
  console.error('  2. pg_restore is in your PATH (usually comes with PostgreSQL installation)');
  console.error('  3. DB credentials in server/.env are correct');
  console.error('  4. The dump file is valid and not corrupted');
  process.exit(1);
}
}
