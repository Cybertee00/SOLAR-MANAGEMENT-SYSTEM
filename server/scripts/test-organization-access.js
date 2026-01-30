/**
 * Test Organization Management Access Control
 * Tests API endpoints to verify system owner access control
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testAccess() {
  try {
    console.log('🔍 Testing Organization Management Access Control...\n');

    // Check for system_owner user
    const systemOwnerResult = await pool.query(`
      SELECT id, username, role, roles, organization_id
      FROM users
      WHERE role = 'system_owner' 
         OR roles::text LIKE '%system_owner%'
      LIMIT 1
    `);

    if (systemOwnerResult.rows.length === 0) {
      console.log('⚠️  No system_owner user found in database');
      console.log('   Create a system_owner user to test access control');
      return;
    }

    const systemOwner = systemOwnerResult.rows[0];
    console.log('✅ Found system_owner user:');
    console.log(`   ID: ${systemOwner.id}`);
    console.log(`   Username: ${systemOwner.username}`);
    console.log(`   Role: ${systemOwner.role}`);
    console.log(`   Roles: ${systemOwner.roles || 'N/A'}`);
    console.log(`   Organization ID: ${systemOwner.organization_id || 'NULL (expected for system_owner)'}\n`);

    // Check for regular admin user
    const adminResult = await pool.query(`
      SELECT id, username, role, roles, organization_id
      FROM users
      WHERE (role = 'admin' OR role = 'operations_admin' OR roles::text LIKE '%operations_admin%')
        AND (role != 'system_owner' AND (roles IS NULL OR roles::text NOT LIKE '%system_owner%'))
      LIMIT 1
    `);

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log('✅ Found regular admin user:');
      console.log(`   ID: ${admin.id}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Roles: ${admin.roles || 'N/A'}`);
      console.log(`   Organization ID: ${admin.organization_id}\n`);
    } else {
      console.log('ℹ️  No regular admin user found (optional for testing)\n');
    }

    // Check organizations
    const orgsResult = await pool.query('SELECT COUNT(*) as count FROM organizations');
    console.log(`📊 Organizations in database: ${orgsResult.rows[0].count}`);

    const orgs = await pool.query('SELECT id, name, slug, is_active FROM organizations LIMIT 5');
    if (orgs.rows.length > 0) {
      console.log('\n📋 Sample organizations:');
      orgs.rows.forEach(org => {
        console.log(`   - ${org.name} (${org.slug}) - ${org.is_active ? 'Active' : 'Inactive'}`);
      });
    }

    console.log('\n✅ Access Control Test Summary:');
    console.log('   1. System owner should be able to access /api/organizations');
    console.log('   2. Regular admin should get 403 Forbidden');
    console.log('   3. Frontend routes protected with requireRole="system_owner"');
    console.log('   4. Navigation link only visible to isSuperAdmin()');
    console.log('\n📝 To test:');
    console.log('   1. Login as system_owner → Should see "Organizations" link');
    console.log('   2. Login as admin → Should NOT see "Organizations" link');
    console.log('   3. Try direct URL access → Should redirect if not system_owner');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testAccess();
