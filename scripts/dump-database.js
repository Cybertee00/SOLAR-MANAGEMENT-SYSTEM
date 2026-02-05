/**
 * Database Dump Script
 * 
 * Creates a PostgreSQL dump file of the solar_om_db database
 * that can be restored on another PC.
 * 
 * Usage:
 *   node scripts/dump-database.js
 * 
 * Output:
 *   database-dump/solar_om_db_YYYY-MM-DD_HH-MM-SS.backup
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

// Create dump directory if it doesn't exist
const dumpDir = path.join(__dirname, 'database-dump');
if (!fs.existsSync(dumpDir)) {
  fs.mkdirSync(dumpDir, { recursive: true });
}

// Generate filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const dumpFile = path.join(dumpDir, `${DB_NAME}_${timestamp}.backup`);

console.log('Creating database dump...');
console.log(`Database: ${DB_NAME}`);
console.log(`Host: ${DB_HOST}:${DB_PORT}`);
console.log(`User: ${DB_USER}`);
console.log(`Output: ${dumpFile}`);
console.log('');

try {
  // Find pg_dump executable
  let pgDumpPath = 'pg_dump';
  
  // On Windows, try to find pg_dump in common locations or use where command
  if (process.platform === 'win32') {
    try {
      // Try to find pg_dump using where command
      const whereOutput = execSync('where pg_dump', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (whereOutput && fs.existsSync(whereOutput)) {
        pgDumpPath = `"${whereOutput}"`;
      }
    } catch (e) {
      // If where fails, try common PostgreSQL installation paths
      const commonPaths = [
        'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\13\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\12\\bin\\pg_dump.exe',
        'C:\\Program Files (x86)\\PostgreSQL\\16\\bin\\pg_dump.exe',
        'C:\\Program Files (x86)\\PostgreSQL\\15\\bin\\pg_dump.exe',
        'C:\\Program Files (x86)\\PostgreSQL\\14\\bin\\pg_dump.exe',
        'C:\\Program Files (x86)\\PostgreSQL\\13\\bin\\pg_dump.exe',
        'C:\\Program Files (x86)\\PostgreSQL\\12\\bin\\pg_dump.exe',
      ];
      
      for (const path of commonPaths) {
        if (fs.existsSync(path)) {
          pgDumpPath = `"${path}"`;
          break;
        }
      }
    }
  }

  // Set PGPASSWORD environment variable for pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: DB_PASSWORD
  };

  // Run pg_dump
  // -F c = custom format (compressed, can be restored with pg_restore)
  // -F p = plain SQL format (can be restored with psql)
  // Using custom format for better compression and portability
  const command = `${pgDumpPath} -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F c -f "${dumpFile}"`;
  
  execSync(command, {
    env: env,
    stdio: 'inherit',
    shell: true
  });

  const stats = fs.statSync(dumpFile);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log('');
  console.log('✓ Database dump created successfully!');
  console.log(`  File: ${dumpFile}`);
  console.log(`  Size: ${fileSizeMB} MB`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Copy this file to the other PC');
  console.log('  2. On the other PC, run: node scripts/restore-database.js <dump-file-path>');
  console.log('     Or manually: pg_restore -U postgres -d solar_om_db <dump-file>');
  
} catch (error) {
  console.error('');
  console.error('✗ Error creating database dump:');
  console.error(error.message);
  console.error('');
  console.error('Make sure:');
  console.error('  1. PostgreSQL is running');
  console.error('  2. pg_dump is accessible:');
  console.error('     - Add PostgreSQL bin folder to PATH, OR');
  console.error('     - Edit this script to use full path to pg_dump.exe');
  console.error('     - Common Windows path: C:\\Program Files\\PostgreSQL\\<version>\\bin\\');
  console.error('  3. DB credentials in server/.env are correct');
  console.error('  4. The database exists and is accessible');
  process.exit(1);
}
