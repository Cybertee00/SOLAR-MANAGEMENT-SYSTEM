const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkUserRoles() {
  try {
    const result = await pool.query(
      'SELECT id, username, role, roles FROM users ORDER BY created_at'
    );
    
    console.log('\n=== User Roles Check ===\n');
    result.rows.forEach(user => {
      const role = user.role || 'NULL';
      const roles = user.roles ? JSON.stringify(user.roles) : 'NULL';
      console.log(`${user.username}:`);
      console.log(`  role column: ${role}`);
      console.log(`  roles column: ${roles}`);
      console.log('');
    });
    
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    pool.end();
  }
}

checkUserRoles();
