require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solar_om_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testLogin() {
  try {
    console.log('Testing login for admin user...\n');
    
    // Get admin user
    const result = await pool.query(
      'SELECT id, username, email, role, password_hash, is_active FROM users WHERE username = $1',
      ['admin']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Username:', user.username);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Is Active:', user.is_active);
    console.log('  Has Password:', !!user.password_hash);
    console.log('');
    
    // Test password "tech1"
    const testPassword = 'tech1';
    console.log(`Testing password: "${testPassword}"`);
    
    if (!user.password_hash) {
      console.log('❌ User has no password hash!');
      process.exit(1);
    }
    
    const passwordMatch = await bcrypt.compare(testPassword, user.password_hash);
    console.log('Password match:', passwordMatch ? '✅ YES' : '❌ NO');
    
    if (passwordMatch) {
      console.log('\n✅ Login should work with:');
      console.log('   Username: admin');
      console.log('   Password: tech1');
    } else {
      console.log('\n❌ Password does not match!');
      console.log('   The password hash in the database does not match "tech1"');
      console.log('\n   Updating password now...');
      
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(testPassword, saltRounds);
      
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE username = $2',
        [newPasswordHash, 'admin']
      );
      
      console.log('✅ Password updated!');
      
      // Test again
      const newMatch = await bcrypt.compare(testPassword, newPasswordHash);
      console.log('   Verification:', newMatch ? '✅ Password works!' : '❌ Still not working');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testLogin();

