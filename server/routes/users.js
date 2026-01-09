const express = require('express');
const bcrypt = require('bcrypt');
const { requireAdmin } = require('../middleware/auth');
const { validateCreateUser, validateUpdateUser } = require('../middleware/inputValidation');
const { sensitiveOperationLimiter } = require('../middleware/rateLimiter');

module.exports = (pool) => {
  const router = express.Router();

  // Get all users (admin only)
  router.get('/', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Get user by ID
  router.get('/:id', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users WHERE id = $1',
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // Create user (admin only) - with password
  // Apply sensitive operation rate limiting
  router.post('/', requireAdmin, sensitiveOperationLimiter, validateCreateUser, async (req, res) => {
    try {
      const { username, email, full_name, role, password } = req.body;

      if (!username || !email || !full_name) {
        return res.status(400).json({ error: 'Username, email, and full name are required' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password is required and must be at least 6 characters long' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user with password
      const result = await pool.query(
        `INSERT INTO users (username, email, full_name, role, password_hash, is_active) 
         VALUES ($1, $2, $3, $4, $5, true) 
         RETURNING id, username, email, full_name, role, is_active, created_at`,
        [username, email, full_name, role || 'technician', passwordHash]
      );

      res.status(201).json({
        message: 'User created successfully',
        user: result.rows[0]
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
  router.put('/:id', requireAdmin, sensitiveOperationLimiter, validateUpdateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, email, full_name, role, is_active, password } = req.body;

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
      if (role !== undefined) {
        updates.push(`role = $${paramCount++}`);
        values.push(role);
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

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, full_name, role, is_active, created_at, last_login`;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'User updated successfully',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating user:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
  });

  // Deactivate user (admin only) - soft delete by setting is_active to false
  router.patch('/:id/deactivate', requireAdmin, async (req, res) => {
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

  return router;
};

