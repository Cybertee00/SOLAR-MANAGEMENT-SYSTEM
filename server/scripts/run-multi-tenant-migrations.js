/**
 * Run Multi-Tenant Migrations 005-007
 * Sets up Smart Innovations Energy organization and migrates data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
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

async function runMigrations() {
  console.log('🚀 Running Multi-Tenant Migrations...\n');

  const migrations = [
    'multi_tenant_005_create_smart_innovations_energy_org.sql',
    'multi_tenant_006_add_organization_id_to_remaining_tables.sql',
    'multi_tenant_007_migrate_existing_data_to_smart_innovations_energy.sql'
  ];

  for (const migration of migrations) {
    console.log(`📄 Running: ${migration}`);
    try {
      const sql = fs.readFileSync(path.join(__dirname, '../db/migrations', migration), 'utf8');
      await pool.query(sql);
      console.log(`✅ SUCCESS: ${migration}\n`);
    } catch (error) {
      console.log(`❌ ERROR in ${migration}: ${error.message}\n`);
    }
  }
  
  await pool.end();
  console.log('✅ Migrations complete!');
}

runMigrations();
