/**
 * Test Script: Multi-Tenant Step 1 & 2
 * Tests that organizations table and configuration tables are created correctly
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

async function testStep1() {
  try {
    console.log('🧪 Testing Multi-Tenant Step 1 & 2...\n');

    // Test 1: Check if organizations table exists
    console.log('1. Checking organizations table...');
    const orgTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'organizations'
    `);
    
    if (orgTableCheck.rows.length === 0) {
      throw new Error('❌ organizations table does not exist');
    }
    console.log('✅ organizations table exists');

    // Test 2: Check organizations table columns
    console.log('\n2. Checking organizations table structure...');
    const orgColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = ['id', 'name', 'slug', 'is_active', 'created_at', 'updated_at'];
    const foundColumns = orgColumns.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`❌ Missing columns in organizations table: ${missingColumns.join(', ')}`);
    }
    console.log('✅ organizations table has all required columns:', foundColumns.join(', '));

    // Test 3: Check configuration tables
    console.log('\n3. Checking configuration tables...');
    const configTables = ['organization_settings', 'organization_features', 'organization_branding'];
    
    for (const tableName of configTables) {
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);
      
      if (tableCheck.rows.length === 0) {
        throw new Error(`❌ ${tableName} table does not exist`);
      }
      console.log(`✅ ${tableName} table exists`);
    }

    // Test 4: Check foreign key relationships
    console.log('\n4. Checking foreign key relationships...');
    const fkCheck = await pool.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'organizations'
    `);
    
    console.log(`✅ Found ${fkCheck.rows.length} foreign key relationships to organizations table`);
    fkCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}.${row.column_name} → organizations`);
    });

    // Test 5: Create a test organization
    console.log('\n5. Testing organization creation...');
    // Check what columns exist in organizations table
    const orgCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'organizations' AND column_name IN ('name', 'slug', 'contact_email', 'billing_email')
    `);
    const hasContactEmail = orgCols.rows.some(r => r.column_name === 'contact_email');
    const hasBillingEmail = orgCols.rows.some(r => r.column_name === 'billing_email');
    
    let insertQuery, insertValues;
    if (hasContactEmail) {
      insertQuery = `INSERT INTO organizations (name, slug, contact_email) VALUES ($1, $2, $3) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id, name, slug`;
      insertValues = ['Test Organization', 'test-org', 'test@example.com'];
    } else if (hasBillingEmail) {
      insertQuery = `INSERT INTO organizations (name, slug, billing_email) VALUES ($1, $2, $3) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id, name, slug`;
      insertValues = ['Test Organization', 'test-org', 'test@example.com'];
    } else {
      insertQuery = `INSERT INTO organizations (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id, name, slug`;
      insertValues = ['Test Organization', 'test-org'];
    }
    
    const testOrg = await pool.query(insertQuery, insertValues);
    
    console.log('✅ Test organization created:', testOrg.rows[0]);

    // Test 6: Create test configuration
    console.log('\n6. Testing configuration creation...');
    const testSetting = await pool.query(`
      INSERT INTO organization_settings (organization_id, setting_key, setting_value)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (organization_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
      RETURNING id, setting_key, setting_value
    `, [testOrg.rows[0].id, 'test_setting', JSON.stringify({ value: 'test' })]);
    
    console.log('✅ Test setting created:', testSetting.rows[0]);

    // Cleanup test data
    console.log('\n7. Cleaning up test data...');
    await pool.query('DELETE FROM organization_settings WHERE organization_id = $1', [testOrg.rows[0].id]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrg.rows[0].id]);
    console.log('✅ Test data cleaned up');

    console.log('\n✅✅✅ All Step 1 & 2 tests passed! ✅✅✅\n');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testStep1();
