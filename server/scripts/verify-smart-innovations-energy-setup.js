/**
 * Verification Script: Smart Innovations Energy Organization Setup
 * Verifies that Smart Innovations Energy organization exists and all data is assigned to it
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const SMART_INNOVATIONS_ENERGY_ID = '00000000-0000-0000-0000-000000000001';

async function verifySetup() {
  try {
    console.log('🔍 Verifying Smart Innovations Energy Organization Setup...\n');

    // Check if organization exists
    const orgResult = await pool.query(
      'SELECT id, name, slug, is_active FROM organizations WHERE slug = $1 OR id = $2',
      ['smart-innovations-energy', SMART_INNOVATIONS_ENERGY_ID]
    );

    if (orgResult.rows.length === 0) {
      console.log('❌ Smart Innovations Energy organization NOT FOUND');
      console.log('   Run migration: multi_tenant_005_create_smart_innovations_energy_org.sql');
      await pool.end();
      process.exit(1);
    }

    const org = orgResult.rows[0];
    console.log(`✅ Organization Found:`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Name: ${org.name}`);
    console.log(`   Slug: ${org.slug}`);
    console.log(`   Active: ${org.is_active}\n`);

    // Check data assignment
    const tables = [
      { name: 'users', column: 'organization_id' },
      { name: 'assets', column: 'organization_id' },
      { name: 'tasks', column: 'organization_id' },
      { name: 'checklist_templates', column: 'organization_id' },
      { name: 'checklist_responses', column: 'organization_id' },
      { name: 'cm_letters', column: 'organization_id' },
      { name: 'inventory_items', column: 'organization_id' },
      { name: 'calendar_events', column: 'organization_id' },
    ];

    console.log('📊 Data Assignment Status:\n');

    for (const table of tables) {
      try {
        // Check if column exists
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        `, [table.name, table.column]);

        if (columnCheck.rows.length === 0) {
          console.log(`   ⚠️  ${table.name}: Column '${table.column}' does not exist`);
          continue;
        }

        // Count total rows
        const totalResult = await pool.query(`SELECT COUNT(*) as count FROM ${table.name}`);
        const total = parseInt(totalResult.rows[0].count);

        // Count rows with organization_id
        const orgResult = await pool.query(
          `SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.column} = $1`,
          [org.id]
        );
        const assigned = parseInt(orgResult.rows[0].count);

        // Count NULL organization_id
        const nullResult = await pool.query(
          `SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.column} IS NULL`
        );
        const nullCount = parseInt(nullResult.rows[0].count);

        if (total === 0) {
          console.log(`   ✅ ${table.name}: No data (empty table)`);
        } else if (nullCount > 0) {
          console.log(`   ⚠️  ${table.name}: ${assigned}/${total} assigned, ${nullCount} NULL`);
        } else {
          console.log(`   ✅ ${table.name}: ${assigned}/${total} assigned`);
        }
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log(`   ⚠️  ${table.name}: Table does not exist`);
        } else {
          console.log(`   ❌ ${table.name}: Error - ${error.message}`);
        }
      }
    }

    // Check indexes
    console.log('\n📇 Index Status:\n');
    const indexCheck = await pool.query(`
      SELECT 
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE '%organization_id%'
      ORDER BY tablename, indexname
    `);

    if (indexCheck.rows.length > 0) {
      console.log(`   ✅ Found ${indexCheck.rows.length} organization_id indexes:`);
      indexCheck.rows.forEach(row => {
        console.log(`      - ${row.tablename}.${row.indexname}`);
      });
    } else {
      console.log('   ⚠️  No organization_id indexes found');
    }

    console.log('\n✅✅✅ Verification Complete! ✅✅✅\n');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

verifySetup();
