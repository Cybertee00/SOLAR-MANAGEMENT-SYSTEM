const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { validateLogin, validateChangePassword } = require('../middleware/inputValidation');

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
      const userResult = await pool.query(
        'SELECT id, username, email, full_name, role, password_hash, is_active FROM users WHERE username = $1 OR email = $1',
        [username]
      );

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
        if (!res.headersSent) {
          return res.status(403).json({ error: 'Account is deactivated. Please contact administrator.' });
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

      // Update last login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.fullName = user.full_name;

      console.log('Session set:', { 
        userId: req.session.userId, 
        username: req.session.username, 
        role: req.session.role,
        sessionId: req.sessionID 
      });

      // Return user info (without password)
      // express-session will automatically save the session when response is sent
      // Make sure we only send response once
      if (!res.headersSent) {
        res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role
          }
        });
      } else {
        console.error('Attempted to send login response but headers already sent');
      }
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error stack:', error.stack);
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({ error: 'Login failed', details: error.message });
      }
    }
  });

  // Logout endpoint
  router.post('/logout', (req, res) => {
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

      // Get fresh user data from database
      const userResult = await pool.query(
        'SELECT id, username, email, full_name, role, is_active, last_login FROM users WHERE id = $1',
        [req.session.userId]
      );

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

      if (!res.headersSent) {
        res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            last_login: user.last_login
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

      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, req.session.userId]
      );

      if (!res.headersSent) {
        res.json({ message: 'Password changed successfully' });
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

