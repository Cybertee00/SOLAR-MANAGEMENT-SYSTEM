/**
 * Feedback Routes
 * Handles user feedback submissions for bug reports, feature requests, etc.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

module.exports = (pool) => {
  const router = express.Router();

  // Submit feedback
  router.post(
    '/',
    [
      body('name')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Name must be less than 255 characters'),
      body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
      body('subject')
        .trim()
        .notEmpty()
        .withMessage('Subject is required')
        .isIn(['bug', 'feature', 'question', 'improvement', 'other'])
        .withMessage('Invalid subject type'),
      body('message')
        .trim()
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ min: 10 })
        .withMessage('Message must be at least 10 characters')
        .isLength({ max: 5000 })
        .withMessage('Message must be less than 5000 characters'),
      body('page_url')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Page URL must be less than 500 characters'),
      body('user_id')
        .optional()
        .isUUID()
        .withMessage('Invalid user ID format')
    ],
    async (req, res) => {
      try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { name, email, subject, message, page_url, user_id } = req.body;

        // Get user name from database if user_id is provided and name is not
        let finalName = name || 'User';
        if (user_id && !name) {
          try {
            const userResult = await pool.query(
              'SELECT full_name, username FROM users WHERE id = $1',
              [user_id]
            );
            if (userResult.rows.length > 0) {
              finalName = userResult.rows[0].full_name || userResult.rows[0].username || 'User';
            }
          } catch (userError) {
            // If user lookup fails, use default
            console.error('[FEEDBACK] Error fetching user name:', userError.message);
          }
        }

        // Insert feedback into database
        const result = await pool.query(
          `INSERT INTO feedback_submissions (
            id, user_id, name, email, subject, message, page_url, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
          [
            uuidv4(),
            user_id || null,
            finalName,
            email,
            subject,
            message,
            page_url || null,
            'new'
          ]
        );

        const feedback = result.rows[0];

        // Log feedback submission for developer visibility
        console.log('[FEEDBACK] New feedback submission:', {
          id: feedback.id,
          subject: subject,
          from: email,
          page: page_url || 'unknown',
          userId: user_id || 'anonymous'
        });

        // TODO: Send email notification to developer (optional enhancement)
        // You can integrate nodemailer or similar here
        // Example:
        // await sendFeedbackEmail({
        //   to: process.env.DEVELOPER_EMAIL,
        //   subject: `[${subject}] Feedback from ${name}`,
        //   body: `Message: ${message}\n\nPage: ${page_url}\nUser: ${email}`
        // });

        res.status(201).json({
          success: true,
          message: 'Feedback submitted successfully',
          id: feedback.id
        });
      } catch (error) {
        console.error('Error submitting feedback:', error);
        
        // Handle database errors
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Duplicate submission detected' });
        }
        
        res.status(500).json({
          error: 'Failed to submit feedback',
          message: 'Please try again later'
        });
      }
    }
  );

  // Get feedback submissions (admin only - optional endpoint for future admin dashboard)
  router.get('/', requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      const isAdmin = req.session.role === 'admin' || 
                     req.session.roles?.includes('admin') ||
                     req.session.roles?.includes('super_admin') ||
                     req.session.role === 'super_admin';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { status, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT id, user_id, name, email, subject, message, page_url, status, created_at
        FROM feedback_submissions
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (status) {
        query += ` AND status = $${paramCount++}`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, params);

      res.json({
        feedback: result.rows,
        total: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  });

  return router;
};
