const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const nodemailer = require('nodemailer');

module.exports = (pool) => {
  const router = express.Router();

  // Validation rules
  const feedbackValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subject').isIn(['question', 'bug', 'feature', 'improvement', 'other']).withMessage('Valid subject is required'),
    body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters'),
    body('page_url').optional().isString().trim(),
  ];

  // Submit feedback
  router.post('/', requireAuth, feedbackValidation, async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, subject, message, page_url } = req.body;
      const userId = req.session.userId;

      // Get user name if user_id is provided
      let userName = 'User';
      if (userId) {
        try {
          const userResult = await pool.query('SELECT full_name, username FROM users WHERE id = $1', [userId]);
          if (userResult.rows.length > 0) {
            userName = userResult.rows[0].full_name || userResult.rows[0].username || 'User';
          }
        } catch (err) {
          console.error('Error fetching user name:', err);
        }
      }

      // Save to database
      const result = await pool.query(
        `INSERT INTO feedback_submissions (user_id, name, email, subject, message, page_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'new')
         RETURNING id, created_at`,
        [userId, userName, email, subject, message, page_url || null]
      );

      const feedbackId = result.rows[0].id;

      // Send email notification (if email is configured)
      try {
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          });

          const subjectLabels = {
            question: 'Question',
            bug: 'Bug Report',
            feature: 'Feature Request',
            improvement: 'Improvement Suggestion',
            other: 'Other'
          };

          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.FEEDBACK_EMAIL || process.env.SMTP_USER,
            subject: `[SPHAiR Feedback] ${subjectLabels[subject] || subject} - ${userName}`,
            html: `
              <h2>New Feedback Submission</h2>
              <p><strong>From:</strong> ${userName} (${email})</p>
              <p><strong>Subject:</strong> ${subjectLabels[subject] || subject}</p>
              <p><strong>Page:</strong> ${page_url || 'Unknown'}</p>
              <p><strong>User ID:</strong> ${userId || 'N/A'}</p>
              <p><strong>Feedback ID:</strong> ${feedbackId}</p>
              <hr>
              <p><strong>Message:</strong></p>
              <p>${message.replace(/\n/g, '<br>')}</p>
            `,
          });
        }
      } catch (emailError) {
        // Log but don't fail the request if email fails
        console.error('Error sending feedback email:', emailError);
      }

      res.json({
        success: true,
        message: 'Feedback submitted successfully',
        id: feedbackId,
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  });

  return router;
};
