require('dotenv').config({ path: './server/.env' });
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
    console.log('Testing login for superadmin...\n');
    
    // Check if user exists
    const userResult = await pool.query(`
      SELECT id, username, email, full_name, role, is_active, 
             password_hash IS NOT NULL as has_password
      FROM users 
      WHERE username = $1 OR email = $1
    `, ['superadmin']);
    
    if (userResult.rows.length === 0) {
      console.log('✗ User "superadmin" not found');
      await pool.end();
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✓ User found:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Is Active: ${user.is_active}`);
    console.log(`  Has Password: ${user.has_password}`);
    
    if (!user.is_active) {
      console.log('\n✗ User account is deactivated');
      await pool.end();
      return;
    }
    
    if (!user.has_password) {
      console.log('\n✗ User has no password set');
      await pool.end();
      return;
    }
    
    // Get actual password_hash
    const hashResult = await pool.query(`
      SELECT password_hash FROM users WHERE username = $1
    `, ['superadmin']);
    
    const actualHash = hashResult.rows[0]?.password_hash;
    console.log(`\nPassword hash: ${actualHash ? actualHash.substring(0, 30) + '...' : 'NULL'}`);
    
    if (!actualHash) {
      console.log('\n✗ Password hash is NULL - need to set password');
      await pool.end();
      return;
    }
    
    // Test password
    const testPassword = '0000';
    try {
      const passwordMatch = await bcrypt.compare(testPassword, actualHash);
      console.log(`\nPassword test ("${testPassword}"): ${passwordMatch ? '✓ MATCH' : '✗ NO MATCH'}`);
      
      if (passwordMatch) {
        console.log('\n✓ Login should work!');
      } else {
        console.log('\n✗ Password does not match');
      }
    } catch (error) {
      console.log(`\n✗ Error comparing password: ${error.message}`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

testLogin();
