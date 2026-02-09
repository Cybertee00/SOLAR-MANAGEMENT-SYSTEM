require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function listUsers() {
  try {
    console.log('📋 Listing all users in the database...\n');

    const result = await pool.query(`
      SELECT 
        id,
        username,
        email,
        full_name,
        role,
        roles,
        is_active,
        organization_id,
        password_hash IS NOT NULL as has_password,
        password_changed,
        profile_image,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at ASC
    `);

    if (result.rows.length === 0) {
      console.log('No users found in the database.');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} user(s):\n`);
    console.log('═'.repeat(120));
    
    result.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Full Name: ${user.full_name || 'N/A'}`);
      console.log(`   Role: ${user.role || 'N/A'}`);
      console.log(`   Roles (JSONB): ${user.roles ? JSON.stringify(user.roles) : 'N/A'}`);
      console.log(`   Active: ${user.is_active ? '✅ Yes' : '❌ No'}`);
      console.log(`   Has Password: ${user.has_password ? '✅ Yes' : '❌ No'}`);
      console.log(`   Password Changed: ${user.password_changed ? '✅ Yes' : '❌ No'}`);
      console.log(`   Profile Image: ${user.profile_image || 'None'}`);
      console.log(`   Organization ID: ${user.organization_id || 'NULL'}`);
      console.log(`   Created: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}`);
      console.log(`   Updated: ${user.updated_at ? new Date(user.updated_at).toLocaleString() : 'N/A'}`);
      
      if (index < result.rows.length - 1) {
        console.log('   ' + '─'.repeat(116));
      }
    });

    console.log('\n' + '═'.repeat(120));
    
    // Summary
    const activeCount = result.rows.filter(u => u.is_active).length;
    const withPasswordCount = result.rows.filter(u => u.has_password).length;
    const withOrgCount = result.rows.filter(u => u.organization_id).length;
    
    console.log('\n📊 Summary:');
    console.log(`   Total Users: ${result.rows.length}`);
    console.log(`   Active Users: ${activeCount}`);
    console.log(`   Users with Password: ${withPasswordCount}`);
    console.log(`   Users with Organization: ${withOrgCount}`);
    console.log(`   Users without Organization: ${result.rows.length - withOrgCount}`);

    await pool.end();
  } catch (error) {
    console.error('Error listing users:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

listUsers();
