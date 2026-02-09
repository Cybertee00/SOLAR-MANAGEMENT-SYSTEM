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

async function fixPassword() {
  try {
    console.log('Fixing superadmin password...\n');
    
    const username = 'superadmin';
    const password = process.env.SUPERADMIN_PASSWORD || process.env.DEFAULT_USER_PASSWORD || 'changeme';
    
    // Check if user exists
    const userResult = await pool.query(`
      SELECT id, username, password_hash IS NOT NULL as has_password
      FROM users 
      WHERE username = $1
    `, [username]);
    
    if (userResult.rows.length === 0) {
      console.log('✗ User not found');
      await pool.end();
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`User found: ${user.username}`);
    console.log(`Has password: ${user.has_password}`);
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Update password
    await pool.query(`
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE username = $2
    `, [passwordHash, username]);
    
    console.log('\n✓ Password updated successfully!');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    
    // Verify
    const verifyResult = await pool.query(`
      SELECT password_hash FROM users WHERE username = $1
    `, [username]);
    
    if (verifyResult.rows[0].password_hash) {
      const match = await bcrypt.compare(password, verifyResult.rows[0].password_hash);
      console.log(`\n✓ Password verification: ${match ? 'SUCCESS' : 'FAILED'}`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixPassword();
