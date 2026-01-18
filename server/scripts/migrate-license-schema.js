/**
 * License Schema Migration Script
 * 
 * Runs the migration to add multi-tenant and advanced license fields:
 * - Multi-tenant support (company_id)
 * - License tiers and features
 * - Revocation mechanism
 * - Signed token support
 * 
 * Usage:
 *   node server/scripts/migrate-license-schema.js
 * 
 * Or with custom database credentials:
 *   node server/scripts/migrate-license-schema.js --user=postgres --password=mypass --host=localhost --port=5432 --database=solar_om_db
 * 
 * Environment variables (from .env):
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

// Allow credentials to be passed as environment variables or command line args
const config = {
  host: process.env.DB_HOST || args.find(arg => arg.startsWith('--host='))?.split('=')[1] || 'localhost',
  port: parseInt(process.env.DB_PORT || args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '5432', 10),
  database: process.env.DB_NAME || args.find(arg => arg.startsWith('--database='))?.split('=')[1] || 'solar_om_db',
  user: process.env.DB_USER || args.find(arg => arg.startsWith('--user='))?.split('=')[1] || 'postgres',
  password: process.env.DB_PASSWORD || args.find(arg => arg.startsWith('--password='))?.split('=')[1] || 'postgres',
};

console.log('\n========================================');
console.log('License Schema Migration');
console.log('========================================\n');
console.log('Database configuration:');
console.log(`  Host: ${config.host}`);
console.log(`  Port: ${config.port}`);
console.log(`  Database: ${config.database}`);
console.log(`  User: ${config.user}`);
console.log(`  Password: ${config.password ? '***' : '(not set)'}`);
console.log('');

const pool = new Pool(config);

async function checkLicensesTable() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'licenses'
      )
    `);
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking licenses table:', error.message);
    return false;
  }
}

async function checkExistingColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'licenses' 
      AND column_name IN ('company_id', 'license_token', 'license_tier', 'is_revoked')
    `);
    return result.rows.map(row => row.column_name);
  } catch (error) {
    console.error('Error checking existing columns:', error.message);
    return [];
  }
}

async function runMigration() {
  let client;
  try {
    // Check if licenses table exists
    console.log('Checking if licenses table exists...');
    const tableExists = await checkLicensesTable();
    
    if (!tableExists) {
      console.error('\n❌ ERROR: licenses table does not exist!');
      console.error('Please run the create_licenses_table.sql migration first.');
      console.error('\nYou can run it with:');
      console.error('  node server/scripts/run-migration.js create_licenses_table.sql');
      process.exit(1);
    }
    
    console.log('✅ licenses table found\n');

    // Check existing columns
    console.log('Checking existing columns...');
    const existingColumns = await checkExistingColumns();
    
    if (existingColumns.length > 0) {
      console.log(`⚠️  Found existing columns: ${existingColumns.join(', ')}`);
      console.log('Migration will use IF NOT EXISTS, so existing columns will be preserved.\n');
    } else {
      console.log('✅ No existing columns found. Migration will add all new fields.\n');
    }

    // Read migration file
    const migrationFile = 'add_multi_tenant_license_fields.sql';
    const migrationPath = path.join(__dirname, '../db/migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migration = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📄 Running migration: ${migrationFile}`);
    console.log('   This will add:');
    console.log('   - company_id (multi-tenant support)');
    console.log('   - license_token (signed token storage)');
    console.log('   - license_tier (small/medium/large/enterprise)');
    console.log('   - license_type (trial/subscription/perpetual)');
    console.log('   - features (JSONB array)');
    console.log('   - is_revoked, revoked_at, revoked_reason (revocation)');
    console.log('   - issued_at (issue timestamp)');
    console.log('   - metadata (JSONB for additional data)');
    console.log('   - Indexes for performance\n');

    // Start transaction
    client = await pool.connect();
    await client.query('BEGIN');

    // Run migration
    await client.query(migration);

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Migration applied successfully!\n');

    // Verify migration
    console.log('Verifying migration...');
    const newColumns = await checkExistingColumns();
    const expectedColumns = ['company_id', 'license_token', 'license_tier', 'is_revoked'];
    const missingColumns = expectedColumns.filter(col => !newColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('✅ All expected columns found');
    } else {
      console.log(`⚠️  Some columns may be missing: ${missingColumns.join(', ')}`);
    }

    // Check existing licenses
    const licenseCount = await client.query('SELECT COUNT(*) as count FROM licenses');
    console.log(`\n📊 Existing licenses: ${licenseCount.rows[0].count}`);
    
    if (parseInt(licenseCount.rows[0].count) > 0) {
      console.log('✅ Existing licenses will be updated with default values');
      console.log('   - license_tier: small');
      console.log('   - license_type: subscription');
      console.log('   - features: []');
      console.log('   - is_revoked: false');
      console.log('   - issued_at: set from created_at');
    }

    console.log('\n========================================');
    console.log('✅ Migration completed successfully!');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('1. Set LICENSE_SIGNING_SECRET in your .env file');
    console.log('   Generate with: openssl rand -hex 32');
    console.log('2. Test license token generation');
    console.log('3. Generate new licenses using the new token format\n');

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('\n⚠️  Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError.message);
      }
    }
    
    console.error('\n❌ Error applying migration:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }
    
    console.error('\nTroubleshooting:');
    console.error('1. Ensure the licenses table exists');
    console.error('2. Check database connection credentials');
    console.error('3. Verify you have ALTER TABLE permissions');
    console.error('\nIf you need to specify database credentials, use:');
    console.error('  node server/scripts/migrate-license-schema.js --user=youruser --password=yourpass --host=localhost --port=5432 --database=yourdb');
    console.error('\nOr set environment variables: DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME');
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
