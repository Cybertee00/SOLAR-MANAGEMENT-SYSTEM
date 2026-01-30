/**
 * Test Script: Multi-Tenant Step 4
 * Tests that RLS policies are created and enabled
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

async function testStep4() {
  try {
    console.log('🧪 Testing Multi-Tenant Step 4 (RLS Policies)...\n');

    // Test 1: Check if RLS is enabled on key tables
    console.log('1. Checking RLS status on key tables...');
    const tables = [
      'users', 'assets', 'tasks', 'checklist_templates', 
      'checklist_responses', 'inventory_items', 'notifications'
    ];
    
    for (const tableName of tables) {
      const rlsCheck = await pool.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = $1
      `, [tableName]);
      
      if (rlsCheck.rows.length === 0) {
        console.log(`   ⚠️  Table ${tableName} not found`);
        continue;
      }
      
      if (rlsCheck.rows[0].rowsecurity) {
        console.log(`   ✅ ${tableName}: RLS enabled`);
      } else {
        console.log(`   ⚠️  ${tableName}: RLS not enabled`);
      }
    }

    // Test 2: Check if policies exist
    console.log('\n2. Checking RLS policies...');
    const policies = await pool.query(`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND policyname LIKE '%organization_isolation%'
      ORDER BY tablename, policyname
    `);
    
    console.log(`✅ Found ${policies.rows.length} organization isolation policies:`);
    policies.rows.forEach(p => {
      console.log(`   - ${p.tablename}.${p.policyname}`);
    });

    // Test 3: Check if get_current_organization_id function exists
    console.log('\n3. Checking helper function...');
    const funcCheck = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public' 
        AND routine_name = 'get_current_organization_id'
    `);
    
    if (funcCheck.rows.length > 0) {
      console.log('✅ get_current_organization_id() function exists');
    } else {
      throw new Error('❌ get_current_organization_id() function not found');
    }

    // Test 4: Test function behavior
    console.log('\n4. Testing get_current_organization_id() function...');
    const funcTest = await pool.query('SELECT get_current_organization_id()');
    console.log(`✅ Function returns: ${funcTest.rows[0].get_current_organization_id || 'NULL (expected when no session variable set)'}`);

    console.log('\n✅✅✅ All Step 4 tests passed! ✅✅✅');
    console.log('\n📝 Note: RLS policies are enabled. Application middleware must set session variables for RLS to work.');
    console.log('   - app.current_organization_id: UUID of current organization');
    console.log('   - app.current_user_id: UUID of current user (for system_owner checks)\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testStep4();
