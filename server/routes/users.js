const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { requireAuth, requireAdmin, requireSuperAdmin, isSuperAdmin } = require('../middleware/auth');
const { validateCreateUser, validateUpdateUser } = require('../middleware/inputValidation');
// Rate limiting removed for frequent use
// const { sensitiveOperationLimiter } = require('../middleware/rateLimiter');

module.exports = (pool) => {
  const router = express.Router();

  // Helper function to check if roles column exists (cached)
  let rolesColumnExists = null;
  const checkRolesColumn = async () => {
    if (rolesColumnExists !== null) return rolesColumnExists;
    try {
      const result = await pool.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = 'users' AND column_name = 'roles'`
      );
      rolesColumnExists = result.rows.length > 0;
      return rolesColumnExists;
    } catch (e) {
      rolesColumnExists = false;
      return false;
    }
  };

  // Get all users (admin only)
  router.get('/', requireAdmin, async (req, res) => {
    try {
      const hasRolesColumn = await checkRolesColumn();

      let query;
      if (hasRolesColumn) {
        query = `SELECT id, username, email, full_name, role,
                        COALESCE(roles, jsonb_build_array(role)) as roles,
                        profile_image, is_active, created_at, last_login 
                 FROM users 
                 ORDER BY created_at DESC`;
      } else {
        query = `SELECT id, username, email, full_name, role,
                        jsonb_build_array(role) as roles,
                        profile_image, is_active, created_at, last_login 
                 FROM users 
                 ORDER BY created_at DESC`;
      }

      const result = await pool.query(query);
      
      // Parse roles for each user
      const users = result.rows.map(user => {
        if (user.roles && typeof user.roles === 'string') {
          try {
            user.roles = JSON.parse(user.roles);
          } catch (e) {
            user.roles = [user.role || 'technician'];
          }
        } else if (!user.roles) {
          user.roles = [user.role || 'technician'];
        }
        return user;
      });
      
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Get user by ID
  router.get('/:id', requireAdmin, async (req, res) => {
    try {
      const hasRolesColumn = await checkRolesColumn();

      let query;
      if (hasRolesColumn) {
        query = `SELECT id, username, email, full_name, role,
                        COALESCE(roles, jsonb_build_array(role)) as roles,
                        profile_image, is_active, created_at, last_login 
                 FROM users 
                 WHERE id = $1`;
      } else {
        query = `SELECT id, username, email, full_name, role,
                        jsonb_build_array(role) as roles,
                        profile_image, is_active, created_at, last_login 
                 FROM users 
                 WHERE id = $1`;
      }

      const result = await pool.query(query, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = result.rows[0];
      // Parse roles JSONB
      if (user.roles && typeof user.roles === 'string') {
        try {
          user.roles = JSON.parse(user.roles);
        } catch (e) {
          user.roles = [user.role || 'technician'];
        }
      } else if (!user.roles) {
        user.roles = [user.role || 'technician'];
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // Create user (admin only) - with password
  // Supports both single role (backward compatibility) and multiple roles
  // Rate limiting removed for frequent use
  router.post('/', requireAdmin, validateCreateUser, async (req, res) => {
    try {
      const { username, email, full_name, role, roles, password } = req.body;

      if (!username || !email || !full_name) {
        return res.status(400).json({ error: 'Username, email, and full name are required' });
      }

      // Use default password "witkop123" if no password provided (super admin only)
      const DEFAULT_PASSWORD = 'witkop123';
      const useDefaultPassword = !password || password.trim() === '';
      
      if (!useDefaultPassword && password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Handle roles: support both 'role' (single) and 'roles' (array)
      let userRoles = ['technician']; // Default
      if (roles && Array.isArray(roles) && roles.length > 0) {
        userRoles = roles;
      } else if (role) {
        userRoles = [role];
      }

      // Validate roles
      const validRoles = ['technician', 'supervisor', 'admin', 'super_admin'];
      const invalidRoles = userRoles.filter(r => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        return res.status(400).json({ 
          error: `Invalid roles: ${invalidRoles.join(', ')}. Valid roles: ${validRoles.join(', ')}` 
        });
      }

      // Hash password (use default if not provided)
      const saltRounds = 10;
      const passwordToHash = useDefaultPassword ? DEFAULT_PASSWORD : password;
      const passwordHash = await bcrypt.hash(passwordToHash, saltRounds);

      // Insert user with password and roles
      // Store roles as JSONB array, and set primary role (first role) for backward compatibility
      // Set password_changed to false if using default password
      const primaryRole = userRoles[0] || 'technician';
      const result = await pool.query(
        `INSERT INTO users (username, email, full_name, role, roles, password_hash, is_active, password_changed) 
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, true, $7) 
         RETURNING id, username, email, full_name, role, roles, is_active, password_changed, created_at`,
        [username, email, full_name, primaryRole, JSON.stringify(userRoles), passwordHash, !useDefaultPassword]
      );

      const user = result.rows[0];
      // Parse roles JSONB for response
      if (user.roles && typeof user.roles === 'string') {
        try {
          user.roles = JSON.parse(user.roles);
        } catch (e) {
          user.roles = [user.role];
        }
      }

      res.status(201).json({
        message: 'User created successfully',
        user: user
      });
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
  });

  // Update user (admin only)
  // Super admin can assign multiple roles, admin can update but only super_admin can assign super_admin role
  // Rate limiting removed for frequent use
  router.put('/:id', requireAdmin, validateUpdateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, email, full_name, role, roles, is_active, password } = req.body;

      // Check if trying to assign super_admin role (only super_admin can do this)
      const isRequestingSuperAdmin = isSuperAdmin(req);
      let userRoles = null;

      if (roles !== undefined) {
        if (!Array.isArray(roles) || roles.length === 0) {
          return res.status(400).json({ error: 'Roles must be a non-empty array' });
        }

        // Validate roles
        const validRoles = ['technician', 'supervisor', 'admin', 'super_admin'];
        const invalidRoles = roles.filter(r => !validRoles.includes(r));
        if (invalidRoles.length > 0) {
          return res.status(400).json({ 
            error: `Invalid roles: ${invalidRoles.join(', ')}. Valid roles: ${validRoles.join(', ')}` 
          });
        }

        // Only super_admin can assign super_admin role
        if (roles.includes('super_admin') && !isRequestingSuperAdmin) {
          return res.status(403).json({ error: 'Only super admin can assign super_admin role' });
        }

        userRoles = roles;
      } else if (role !== undefined) {
        // Single role (backward compatibility)
        userRoles = [role];
        
        // Only super_admin can assign super_admin role
        if (role === 'super_admin' && !isRequestingSuperAdmin) {
          return res.status(403).json({ error: 'Only super admin can assign super_admin role' });
        }
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (username !== undefined) {
        updates.push(`username = $${paramCount++}`);
        values.push(username);
      }
      if (email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }
      if (full_name !== undefined) {
        updates.push(`full_name = $${paramCount++}`);
        values.push(full_name);
      }
      if (userRoles !== null) {
        // Update both roles (array) and role (primary role for backward compatibility)
        const primaryRole = userRoles[0] || 'technician';
        updates.push(`roles = $${paramCount++}::jsonb`);
        values.push(JSON.stringify(userRoles));
        updates.push(`role = $${paramCount++}`);
        values.push(primaryRole);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(is_active);
      }
      if (password !== undefined) {
        if (password.length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        updates.push(`password_hash = $${paramCount++}`);
        values.push(passwordHash);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const hasRolesColumn = await checkRolesColumn();
      const rolesSelect = hasRolesColumn 
        ? 'COALESCE(roles, jsonb_build_array(role)) as roles'
        : 'jsonb_build_array(role) as roles';

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} 
                     RETURNING id, username, email, full_name, role, 
                               ${rolesSelect},
                               profile_image, is_active, created_at, last_login`;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updatedUser = result.rows[0];
      
      // Parse roles JSONB for response
      if (updatedUser.roles && typeof updatedUser.roles === 'string') {
        try {
          updatedUser.roles = JSON.parse(updatedUser.roles);
        } catch (e) {
          updatedUser.roles = [updatedUser.role || 'technician'];
        }
      } else if (!updatedUser.roles) {
        updatedUser.roles = [updatedUser.role || 'technician'];
      }

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error updating user:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
  });

  // Deactivate user (super_admin only) - soft delete by setting is_active to false
  router.patch('/:id/deactivate', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent deactivating yourself
      if (id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
      }

      // Soft delete by setting is_active to false
      const result = await pool.query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, username',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating user:', error);
      res.status(500).json({ error: 'Failed to deactivate user', details: error.message });
    }
  });

  // Delete user (admin only) - hard delete from database
  router.delete('/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent deleting yourself
      if (id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
      }

      // Hard delete - remove user from database
      const result = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, username',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
  });

  // Profile routes - users can manage their own profile
  // Get current user's profile
  router.get('/profile/me', requireAuth, async (req, res) => {
    try {
      const hasRolesColumn = await checkRolesColumn();
      const rolesSelect = hasRolesColumn 
        ? 'COALESCE(roles, jsonb_build_array(role)) as roles'
        : 'jsonb_build_array(role) as roles';
      
      const result = await pool.query(
        `SELECT id, username, email, full_name, role,
                ${rolesSelect},
                profile_image, is_active, created_at, last_login 
         FROM users 
         WHERE id = $1`,
        [req.session.userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = result.rows[0];
      // Parse roles JSONB
      if (user.roles && typeof user.roles === 'string') {
        try {
          user.roles = JSON.parse(user.roles);
        } catch (e) {
          user.roles = [user.role || 'technician'];
        }
      } else if (!user.roles) {
        user.roles = [user.role || 'technician'];
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  // Update current user's profile (name, surname, email, username, password)
  router.put('/profile/me', requireAuth, async (req, res) => {
    try {
      const { full_name, email, username, password, current_password } = req.body;
      const userId = req.session.userId;

      // Validate that current password is provided if changing password
      if (password) {
        if (!current_password) {
          return res.status(400).json({ error: 'Current password is required to change password' });
        }

        // Verify current password
        const userResult = await pool.query(
          'SELECT password_hash FROM users WHERE id = $1',
          [userId]
        );

        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        const passwordMatch = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
        if (!passwordMatch) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Validate new password
        if (password.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
      }

      // Build update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (full_name !== undefined) {
        updates.push(`full_name = $${paramCount++}`);
        values.push(full_name.trim());
      }

      if (email !== undefined) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
        updates.push(`email = $${paramCount++}`);
        values.push(email.trim().toLowerCase());
      }

      if (username !== undefined) {
        // Check if username is already taken by another user
        const usernameCheck = await pool.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username.trim(), userId]
        );
        if (usernameCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Username already taken' });
        }
        updates.push(`username = $${paramCount++}`);
        values.push(username.trim());
      }

      if (password) {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        updates.push(`password_hash = $${paramCount++}`);
        values.push(passwordHash);
        // Set password_changed to true when user changes password
        updates.push(`password_changed = true`);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const hasRolesColumn = await checkRolesColumn();
      const rolesSelect = hasRolesColumn 
        ? 'COALESCE(roles, jsonb_build_array(role)) as roles'
        : 'jsonb_build_array(role) as roles';
      
      const result = await pool.query(
        `UPDATE users 
         SET ${updates.join(', ')} 
         WHERE id = $${paramCount}
         RETURNING id, username, email, full_name, role, 
                   ${rolesSelect}, 
                   profile_image, is_active, created_at, last_login`,
        values
      );

      // Parse roles
      const user = result.rows[0];
      if (user.roles && typeof user.roles === 'string') {
        try {
          user.roles = JSON.parse(user.roles);
        } catch (e) {
          user.roles = [user.role || 'technician'];
        }
      } else if (!user.roles) {
        user.roles = [user.role || 'technician'];
      }

      // Update session if name or username changed
      if (full_name !== undefined) {
        req.session.fullName = user.full_name;
      }
      if (username !== undefined) {
        req.session.username = user.username;
      }
      if (full_name !== undefined || username !== undefined) {
        req.session.save();
      }

      res.json({
        message: 'Profile updated successfully',
        user: user
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Email already exists' });
      }
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  });

  // Configure multer for profile image uploads
  const profileImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads/profiles');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename: profile-userId-timestamp-uuid-originalname
      const userId = req.session.userId;
      const uniqueName = `profile-${userId}-${Date.now()}-${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  });

  const profileImageUpload = multer({
    storage: profileImageStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit for profile images
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
      }
    }
  });

  // Upload profile image
  router.post('/profile/me/avatar', requireAuth, (req, res, next) => {
    profileImageUpload.single('image')(req, res, (err) => {
      if (err) {
        console.error('[PROFILE IMAGE] Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
        }
        if (err.message) {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: 'File upload error', details: err.message || err.toString() });
      }
      next();
    });
  }, async (req, res) => {
    try {
      console.log('[PROFILE IMAGE] Upload request received');
      console.log('[PROFILE IMAGE] Session userId:', req.session?.userId);
      console.log('[PROFILE IMAGE] File:', req.file ? { filename: req.file.filename, size: req.file.size } : 'No file');
      
      if (!req.file) {
        console.error('[PROFILE IMAGE] No file provided');
        return res.status(400).json({ error: 'No image file provided' });
      }

      const userId = req.session.userId;
      if (!userId) {
        console.error('[PROFILE IMAGE] No userId in session');
        // Delete uploaded file
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting uploaded file:', unlinkError);
          }
        }
        return res.status(401).json({ error: 'Authentication required' });
      }

      const filename = req.file.filename;
      const filePath = `/uploads/profiles/${filename}`;

      console.log('[PROFILE IMAGE] Updating user profile_image:', filePath);

      // Get old profile image to delete it later
      const oldUserResult = await pool.query(
        'SELECT profile_image FROM users WHERE id = $1',
        [userId]
      );

      const oldProfileImage = oldUserResult.rows[0]?.profile_image;

      // Update user's profile_image
      const result = await pool.query(
        `UPDATE users 
         SET profile_image = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, username, email, full_name, profile_image`,
        [filePath, userId]
      );

      if (result.rows.length === 0) {
        console.error('[PROFILE IMAGE] User not found:', userId);
        // Delete uploaded file
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting uploaded file:', unlinkError);
          }
        }
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete old profile image if it exists
      if (oldProfileImage) {
        const oldImagePath = path.join(__dirname, '..', oldProfileImage);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log('[PROFILE IMAGE] Deleted old profile image:', oldImagePath);
          } catch (unlinkError) {
            console.error('[PROFILE IMAGE] Error deleting old image:', unlinkError);
            // Don't fail the request if old image deletion fails
          }
        }
      }

      console.log('[PROFILE IMAGE] Upload successful:', filePath);
      res.json({
        message: 'Profile image uploaded successfully',
        profile_image: filePath
      });
    } catch (error) {
      console.error('[PROFILE IMAGE] Error uploading profile image:', error);
      console.error('[PROFILE IMAGE] Error stack:', error.stack);
      // Delete uploaded file if database update fails
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('[PROFILE IMAGE] Deleted uploaded file due to error');
        } catch (unlinkError) {
          console.error('[PROFILE IMAGE] Error deleting uploaded file:', unlinkError);
        }
      }
      res.status(500).json({ 
        error: 'Failed to upload profile image', 
        details: error.message 
      });
    }
  });

  return router;
};

