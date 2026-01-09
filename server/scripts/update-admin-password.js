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

async function updateAdminPassword() {
  try {
    console.log('Updating admin password to "tech1"...');
    
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash('tech1', saltRounds);
    
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE username = 'admin' 
       RETURNING username, email, role`,
      [newPasswordHash]
    );
    
    if (result.rows.length === 0) {
      console.log('Admin user not found. Creating admin user...');
      await pool.query(
        `INSERT INTO users (username, email, full_name, role, password_hash, is_active)
         VALUES ('admin', 'admin@solarom.com', 'System Administrator', 'admin', $1, true)
         RETURNING username, email, role`,
        [newPasswordHash]
      );
      console.log('✓ Admin user created with password: tech1');
    } else {
      console.log('✓ Admin password updated successfully!');
      console.log('  Username: admin');
      console.log('  Password: tech1');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating admin password:', error);
    process.exit(1);
  }
}

updateAdminPassword();

