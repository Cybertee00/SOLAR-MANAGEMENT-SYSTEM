const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { validateLogin, validateChangePassword } = require('../middleware/inputValidation');
const { generateToken } = require('../utils/jwt');
const { storeToken, storeUserSession, getUserSession, deleteUserSession, deleteToken } = require('../utils/redis');
const deleteRedisToken = deleteToken; // Alias for clarity

module.exports = (pool) => {
  const router = express.Router();

  // Login endpoint
  // Rate limiting applied in index.js (authLimiter)
  // Input validation applied via middleware
  router.post('/login', validateLogin, async (req, res) => {
    try {
      let { username, password } = req.body;

      // Mobile keyboards / autofill can introduce leading/trailing spaces.
      // Normalize username/email input so "admin " works the same as "admin".
      if (typeof username === 'string') username = username.trim();

      console.log('Login attempt:', { username, hasPassword: !!password });

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Find user by username
      // Support both 'role' (single) and 'roles' (array) for backward compatibility
      // Try to query with roles column, fallback if it doesn't exist
      let userResult;
      let hasRolesColumn = false;
      
      try {
        // Try query with roles column first
        userResult = await pool.query(
          `SELECT id, username, email, full_name, 
                  COALESCE(roles, jsonb_build_array(role)) as roles,
                  role, profile_image, password_hash, is_active 
           FROM users 
           WHERE username = $1 OR email = $1`,
          [username]
        );
        hasRolesColumn = true;
      } catch (error) {
        // If roles column doesn't exist, use fallback query
        if (error.code === '42703' || error.message.includes('roles')) {
          console.log('roles column not found, using fallback query');
          userResult = await pool.query(
            `SELECT id, username, email, full_name, 
                    role, profile_image, password_hash, is_active 
             FROM users 
             WHERE username = $1 OR email = $1`,
            [username]
          );
          hasRolesColumn = false;
        } else {
          // Re-throw if it's a different error
          throw error;
        }
      }

      console.log('User query result:', { found: userResult.rows.length > 0, username: username });

      if (userResult.rows.length === 0) {
        console.log('User not found for username:', username);
        if (!res.headersSent) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
        return;
      }

      const user = userResult.rows[0];
      console.log('User found:', { id: user.id, username: user.username, role: user.role, is_active: user.is_active, has_password: !!user.password_hash });

      // Check if user is active
      if (!user.is_active) {
        console.log('User account is deactivated');
        
        // Get admin email for the error message
        let adminEmail = 'the administrator';
        try {
          // Try to get super_admin first, then admin
          let adminResult;
          try {
            // Try query with roles column
            adminResult = await pool.query(
              `SELECT email FROM users 
               WHERE (
                 role = 'super_admin' 
                 OR role = 'admin'
                 OR (roles IS NOT NULL AND (roles @> '["super_admin"]'::jsonb OR roles @> '["admin"]'::jsonb))
               )
               AND is_active = true 
               AND email IS NOT NULL 
               ORDER BY 
                 CASE 
                   WHEN role = 'super_admin' OR (roles IS NOT NULL AND roles @> '["super_admin"]'::jsonb) THEN 1
                   WHEN role = 'admin' OR (roles IS NOT NULL AND roles @> '["admin"]'::jsonb) THEN 2
                   ELSE 3
                 END
               LIMIT 1`
            );
          } catch (rolesError) {
            // Fallback if roles column doesn't exist
            if (rolesError.code === '42703' || rolesError.message.includes('roles')) {
              adminResult = await pool.query(
                `SELECT email FROM users 
                 WHERE (role = 'super_admin' OR role = 'admin')
                 AND is_active = true 
                 AND email IS NOT NULL 
                 ORDER BY CASE WHEN role = 'super_admin' THEN 1 ELSE 2 END
                 LIMIT 1`
              );
            } else {
              throw rolesError;
            }
          }
          
          if (adminResult.rows.length > 0 && adminResult.rows[0].email) {
            adminEmail = adminResult.rows[0].email;
          }
        } catch (err) {
          console.error('Error fetching admin email:', err);
          // Use default message if query fails
        }
        
        if (!res.headersSent) {
          return res.status(403).json({ 
            error: 'ACCESS RESTRICTED',
            message: `Your account access has been restricted. Please contact the administrator at ${adminEmail} for assistance.`,
            admin_email: adminEmail
          });
        }
        return;
      }

      // Check if user has a password set
      if (!user.password_hash) {
        console.log('User has no password set');
        if (!res.headersSent) {
          return res.status(401).json({ 
            error: 'Account not set up. Please contact administrator to set your password.' 
          });
        }
        return;
      }

      // Verify password
      console.log('Comparing password...');
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      console.log('Password match result:', passwordMatch);

      if (!passwordMatch) {
        console.log('Password mismatch for user:', username);
        if (!res.headersSent) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
        return;
      }

      // Check if user is using default password
      const DEFAULT_PASSWORD = 'witkop123';
      const isDefaultPassword = await bcrypt.compare(DEFAULT_PASSWORD, user.password_hash);
      
      // Check password_changed column if it exists
      let passwordChanged = true; // Default to true for backward compatibility
      try {
        const passwordChangedResult = await pool.query(
          `SELECT password_changed FROM users WHERE id = $1`,
          [user.id]
        );
        if (passwordChangedResult.rows.length > 0 && passwordChangedResult.rows[0].password_changed !== null) {
          passwordChanged = passwordChangedResult.rows[0].password_changed;
        } else {
          // If column doesn't exist or is null, check by comparing with default password
          passwordChanged = !isDefaultPassword;
        }
      } catch (e) {
        // Column might not exist yet, use password comparison
        passwordChanged = !isDefaultPassword;
      }

      // Update last login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Parse roles (support both array and single role)
      let userRoles = [];
      try {
        if (hasRolesColumn && user.roles) {
          if (Array.isArray(user.roles)) {
            userRoles = user.roles;
          } else if (typeof user.roles === 'string') {
            try {
              userRoles = JSON.parse(user.roles);
            } catch (e) {
              console.log('Failed to parse roles JSON, using role field:', e.message);
              userRoles = [user.role || 'technician']; // Fallback
            }
          }
        } else if (user.role) {
          userRoles = [user.role]; // Backward compatibility
        } else {
          userRoles = ['technician']; // Default
        }
      } catch (error) {
        console.error('Error parsing roles:', error);
        // Fallback to role field
        userRoles = [user.role || 'technician'];
      }

      // Set session (store both for backward compatibility)
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.roles = userRoles; // Array of roles (new)
      req.session.role = userRoles[0] || user.role || 'technician'; // Primary role (backward compatibility)
      req.session.fullName = user.full_name;

      console.log('Session set:', { 
        userId: req.session.userId, 
        username: req.session.username, 
        roles: req.session.roles,
        role: req.session.role, // Primary role for backward compatibility
        sessionId: req.sessionID 
      });

      // Explicitly save session to ensure cookie is set
      // This is important for session persistence
      req.session.save(async (err) => {
        if (err) {
          console.error('Error saving session:', err);
          if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to save session' });
          }
          return;
        }

        console.log('Session saved successfully');

        // Single-Device-Per-Session: Check for existing active session
        const existingToken = await getUserSession(user.id);
        if (existingToken) {
          console.log(`[AUTH] User ${user.id} has existing session, invalidating old session`);
          // Delete the old token from Redis
          await deleteRedisToken(existingToken);
          // Destroy the old session if it exists in the database
          // Note: We can't destroy another session, but the token is now invalid
        }

        // Generate JWT token
        const jwtToken = generateToken({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          roles: userRoles,
          role: userRoles[0] || user.role
        });

        // Store JWT token in Redis (if available)
        await storeToken(jwtToken, {
          userId: user.id,
          username: user.username,
          roles: userRoles,
          role: userRoles[0] || user.role,
          fullName: user.full_name
        }, 86400); // 24 hours

        // Store active session for user (single-device-per-session)
        await storeUserSession(user.id, jwtToken, 86400); // 24 hours

        // Return user info (without password) with JWT token
        // Make sure we only send response once
        if (!res.headersSent) {
        res.json({
          message: 'Login successful',
          token: jwtToken, // JWT token for stateless authentication
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            profile_image: user.profile_image || null,
            role: userRoles[0] || user.role, // Primary role for backward compatibility
            roles: userRoles, // Array of all roles
            password_changed: passwordChanged // Flag to indicate if password needs to be changed
          },
          requires_password_change: !passwordChanged // Flag for frontend to show password change modal
        });
        } else {
          console.error('Attempted to send login response but headers already sent');
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        // Provide more helpful error messages
        if (error.code === '42703') {
          // Column doesn't exist
          res.status(500).json({ 
            error: 'Database schema error', 
            details: 'Please run database migrations. The roles column may be missing.' 
          });
        } else if (error.code === '42P01') {
          // Table doesn't exist
          res.status(500).json({ 
            error: 'Database schema error', 
            details: 'Required database tables are missing. Please run database migrations.' 
          });
        } else {
          res.status(500).json({ 
            error: 'Login failed', 
            details: error.message 
          });
        }
      }
    }
  });

  // Logout endpoint
  router.post('/logout', async (req, res) => {
    // Delete JWT token from Redis if provided
    const { extractToken } = require('../utils/jwt');
    const token = extractToken(req);
    const userId = req.session?.userId;
    
    // Delete user session (single-device-per-session)
    if (userId) {
      await deleteUserSession(userId);
    } else if (token) {
      // Fallback: delete token directly if no userId
      await deleteRedisToken(token);
    }

    // Get the session name from the session store configuration
    const sessionName = 'sessionId'; // Matches the name set in index.js
    
    // Clear cookie first, then destroy session
    res.clearCookie(sessionName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED === 'true',
      sameSite: 'strict',
      path: '/'
    });
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        // Don't try to send response if headers already sent
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Logout failed' });
        }
        return;
      }
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.json({ message: 'Logout successful' });
      }
    });
  });

  // Check current session
  router.get('/me', async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        if (!res.headersSent) {
          return res.status(401).json({ error: 'Not authenticated' });
        }
        return;
      }

      // Get fresh user data from database (with roles support if column exists)
      // Check if roles column exists first
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'roles'
      `);
      const hasRolesColumn = columnCheck.rows.length > 0;

      let userResult;
      if (hasRolesColumn) {
        userResult = await pool.query(
          `SELECT id, username, email, full_name, role,
                  COALESCE(roles, jsonb_build_array(role)) as roles,
                  profile_image, is_active, last_login,
                  COALESCE(password_changed, true) as password_changed
           FROM users 
           WHERE id = $1`,
          [req.session.userId]
        );
      } else {
        userResult = await pool.query(
          `SELECT id, username, email, full_name, role,
                  profile_image, is_active, last_login,
                  COALESCE(password_changed, true) as password_changed
           FROM users 
           WHERE id = $1`,
          [req.session.userId]
        );
      }

      if (userResult.rows.length === 0) {
        req.session.destroy(() => {
          // Session destroyed, but don't send response if headers already sent
        });
        if (!res.headersSent) {
          return res.status(401).json({ error: 'User not found' });
        }
        return;
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        req.session.destroy(() => {
          // Session destroyed, but don't send response if headers already sent
        });
        if (!res.headersSent) {
          return res.status(403).json({ error: 'Account is deactivated' });
        }
        return;
      }

      // Parse roles
      let userRoles = [];
      if (hasRolesColumn && user.roles) {
        if (Array.isArray(user.roles)) {
          userRoles = user.roles;
        } else if (typeof user.roles === 'string') {
          try {
            userRoles = JSON.parse(user.roles);
          } catch (e) {
            userRoles = [user.role || 'technician'];
          }
        }
      } else if (user.role) {
        userRoles = [user.role];
      } else {
        userRoles = ['technician'];
      }

      // Get password_changed status
      const passwordChanged = user.password_changed !== false; // Default to true if null (backward compatibility)

      // Update session with fresh roles
      req.session.roles = userRoles;
      req.session.role = userRoles[0] || user.role || 'technician';

      if (!res.headersSent) {
        res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            profile_image: user.profile_image || null,
            role: userRoles[0] || user.role, // Primary role for backward compatibility
            roles: userRoles, // Array of all roles
            last_login: user.last_login,
            password_changed: passwordChanged
          }
        });
      }
    } catch (error) {
      console.error('Session check error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Session check failed', details: error.message });
      }
    }
  });

  // Change password (for authenticated users)
  router.post('/change-password', validateChangePassword, async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        if (!res.headersSent) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        return;
      }

      const { currentPassword, newPassword } = req.body;

      // Validation is handled by validateChangePassword middleware
      // But keep these checks as fallback
      if (!currentPassword || !newPassword) {
        if (!res.headersSent) {
          return res.status(400).json({ error: 'Current password and new password are required' });
        }
        return;
      }

      if (newPassword.length < 6) {
        if (!res.headersSent) {
          return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
        return;
      }

      // Get user's current password hash
      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.session.userId]
      );

      if (userResult.rows.length === 0) {
        if (!res.headersSent) {
          return res.status(404).json({ error: 'User not found' });
        }
        return;
      }

      const user = userResult.rows[0];

      // Verify current password
      if (user.password_hash) {
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordMatch) {
          if (!res.headersSent) {
            return res.status(401).json({ error: 'Current password is incorrect' });
          }
          return;
        }
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password and set password_changed flag to true
      await pool.query(
        `UPDATE users 
         SET password_hash = $1, 
             password_changed = true, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newPasswordHash, req.session.userId]
      );

      // Update session to reflect password change
      if (req.session) {
        req.session.passwordChanged = true;
      }

      if (!res.headersSent) {
        res.json({ 
          message: 'Password changed successfully',
          password_changed: true
        });
      }
    } catch (error) {
      console.error('Change password error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to change password', details: error.message });
      }
    }
  });

  return router;
};

