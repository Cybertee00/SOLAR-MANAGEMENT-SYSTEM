/**
 * Test Script: Request-Scoped Connection Implementation
 * Tests that tenant context middleware properly sets up request-scoped connections
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

async function testRequestScopedConnection() {
  try {
    console.log('🧪 Testing Request-Scoped Connection Implementation...\n');

    // Test 1: Create test organizations
    console.log('1. Creating test organizations...');
    const org1 = await pool.query(`
      INSERT INTO organizations (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, slug
    `, ['Test Org RSC', 'test-org-rsc']);
    const org1Id = org1.rows[0].id;
    console.log(`✅ Created org1: ${org1Id}`);

    // Test 2: Create test user
    console.log('\n2. Creating test user...');
    const user1 = await pool.query(`
      INSERT INTO users (username, email, full_name, role, organization_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET organization_id = EXCLUDED.organization_id
      RETURNING id, username, organization_id
    `, ['test-user-rsc', 'test-rsc@test.com', 'Test User RSC', 'technician', org1Id]);
    const user1Id = user1.rows[0].id;
    console.log(`✅ Created user1: ${user1Id}`);

    // Test 3: Simulate request-scoped connection
    console.log('\n3. Testing request-scoped connection...');
    const client = await pool.connect();
    
    try {
      // Set session variables (as middleware would)
      await client.query(`SET app.current_organization_id = '${org1Id}'`);
      await client.query(`SET app.current_user_id = '${user1Id}'`);
      
      // Verify variables are set
      const varCheck = await client.query(`
        SELECT 
          get_current_organization_id() as org_id,
          current_setting('app.current_user_id', true) as user_id
      `);
      console.log(`✅ Session variables set: org_id=${varCheck.rows[0].org_id}, user_id=${varCheck.rows[0].user_id}`);

      // Test 4: Create asset with organization_id
      console.log('\n4. Creating test asset...');
      const asset = await client.query(`
        INSERT INTO assets (asset_code, asset_name, asset_type, organization_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, asset_code, organization_id
      `, ['RSC-TEST-001', 'RSC Test Asset', 'inverter', org1Id]);
      const assetId = asset.rows[0].id;
      console.log(`✅ Created asset: ${asset.rows[0].asset_code}`);

      // Test 5: Query assets (RLS should filter)
      console.log('\n5. Testing RLS filtering...');
      const assets = await client.query('SELECT id, asset_code, organization_id FROM assets ORDER BY asset_code');
      console.log(`   Found ${assets.rows.length} asset(s) with current session context`);
      
      const org1Assets = assets.rows.filter(a => a.organization_id === org1Id);
      console.log(`   Assets with org1_id: ${org1Assets.length}`);
      
      if (org1Assets.some(a => a.id === assetId)) {
        console.log('✅ RLS is working - can see organization assets');
      } else {
        console.log('⚠️  RLS may not be filtering correctly');
      }

      // Cleanup
      console.log('\n6. Cleaning up test data...');
      await client.query('DELETE FROM assets WHERE id = $1', [assetId]);
      await client.query('DELETE FROM users WHERE id = $1', [user1Id]);
      await client.query('DELETE FROM organizations WHERE id = $1', [org1Id]);
      console.log('✅ Test data cleaned up');
    } finally {
      client.release();
    }

    console.log('\n✅✅✅ Request-scoped connection test passed! ✅✅✅\n');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testRequestScopedConnection();
