/**
 * Migration script to migrate existing users to RBAC system
 * Maps legacy roles to new RBAC roles and assigns appropriate permissions
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'solar_om_db'}`
});

// Role mapping from legacy to new RBAC roles
const ROLE_MAPPING = {
  'super_admin': 'system_owner',
  'admin': 'operations_admin',
  'supervisor': 'supervisor',
  'technician': 'technician'
};

async function migrateUsersToRBAC() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting RBAC migration...');
    
    // Check if RBAC tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('roles', 'permissions', 'role_permissions', 'user_roles')
    `);
    
    if (tablesCheck.rows.length < 4) {
      console.error('RBAC tables do not exist. Please run the create_rbac_system.sql migration first.');
      await client.query('ROLLBACK');
      process.exit(1);
    }
    
    // Get all users
    const usersResult = await client.query(`
      SELECT id, username, email, full_name, role, roles, is_active
      FROM users
      WHERE is_active = TRUE
    `);
    
    console.log(`Found ${usersResult.rows.length} active users to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const user of usersResult.rows) {
      // Determine user roles
      let userRoles = [];
      
      // Try to parse roles from JSONB array
      if (user.roles) {
        try {
          if (Array.isArray(user.roles)) {
            userRoles = user.roles;
          } else if (typeof user.roles === 'string') {
            userRoles = JSON.parse(user.roles);
          }
        } catch (e) {
          console.warn(`Failed to parse roles for user ${user.username}, using role field`);
        }
      }
      
      // Fallback to single role
      if (userRoles.length === 0 && user.role) {
        userRoles = [user.role];
      }
      
      // Map legacy roles to new RBAC roles
      const mappedRoles = userRoles.map(role => ROLE_MAPPING[role] || role);
      
      // Check if user already has roles assigned in user_roles table
      const existingRoles = await client.query(
        `SELECT role_id FROM user_roles WHERE user_id = $1`,
        [user.id]
      );
      
      if (existingRoles.rows.length > 0) {
        console.log(`  ⏭️  Skipping ${user.username} - already has roles assigned`);
        skipped++;
        continue;
      }
      
      // Assign roles to user
      for (const roleCode of mappedRoles) {
        // Get role ID
        const roleResult = await client.query(
          `SELECT id FROM roles WHERE role_code = $1`,
          [roleCode]
        );
        
        if (roleResult.rows.length === 0) {
          console.warn(`  ⚠️  Role ${roleCode} not found for user ${user.username}, skipping`);
          continue;
        }
        
        const roleId = roleResult.rows[0].id;
        
        // Insert user role assignment
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [user.id, roleId]
        );
        
        console.log(`  ✓ Assigned role ${roleCode} to ${user.username}`);
      }
      
      migrated++;
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Migration completed!');
    console.log(`   Migrated: ${migrated} users`);
    console.log(`   Skipped: ${skipped} users (already had roles)`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateUsersToRBAC()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
