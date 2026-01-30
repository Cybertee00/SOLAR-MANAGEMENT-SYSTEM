/**
 * Test Script: Multi-Tenant Step 5
 * Tests that tenant context middleware is properly set up
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

async function testStep5() {
  try {
    console.log('🧪 Testing Multi-Tenant Step 5 (Tenant Context Middleware)...\n');

    // Test 1: Check if middleware file exists
    console.log('1. Checking middleware file...');
    const fs = require('fs');
    const path = require('path');
    const middlewarePath = path.join(__dirname, '../middleware/tenantContext.js');
    
    if (fs.existsSync(middlewarePath)) {
      console.log('✅ tenantContext.js middleware file exists');
    } else {
      throw new Error('❌ tenantContext.js middleware file not found');
    }

    // Test 2: Check if helper function exists
    console.log('\n2. Checking query helper...');
    const helperPath = path.join(__dirname, '../utils/tenantQuery.js');
    
    if (fs.existsSync(helperPath)) {
      console.log('✅ tenantQuery.js helper file exists');
    } else {
      throw new Error('❌ tenantQuery.js helper file not found');
    }

    // Test 3: Test query helper function
    console.log('\n3. Testing query helper function...');
    const { queryWithTenantContext } = require('../utils/tenantQuery');
    
    const testContext = {
      organizationId: '00000000-0000-0000-0000-000000000000',
      userId: '00000000-0000-0000-0000-000000000000'
    };
    
    const result = await queryWithTenantContext(
      pool,
      testContext,
      `SELECT get_current_organization_id() as org_id, current_setting('app.current_user_id', true) as user_id`
    );
    
    console.log('✅ Query helper executed successfully');
    console.log(`   Organization ID from context: ${result.rows[0].org_id || 'NULL'}`);
    console.log(`   User ID from context: ${result.rows[0].user_id || 'NULL'}`);

    // Test 4: Verify middleware can be imported
    console.log('\n4. Testing middleware import...');
    const { setTenantContext, requireOrganization, requireSystemOwner } = require('../middleware/tenantContext');
    
    if (typeof setTenantContext === 'function') {
      console.log('✅ setTenantContext function exported');
    } else {
      throw new Error('❌ setTenantContext is not a function');
    }
    
    if (typeof requireOrganization === 'function') {
      console.log('✅ requireOrganization function exported');
    }
    
    if (typeof requireSystemOwner === 'function') {
      console.log('✅ requireSystemOwner function exported');
    }

    console.log('\n✅✅✅ All Step 5 tests passed! ✅✅✅');
    console.log('\n📝 Note: Middleware is set up. Ensure it\'s added to routes in server/index.js\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testStep5();
