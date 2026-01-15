/**
 * License Management Routes
 * Handles license activation, status checks, and renewal
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { 
  generateLicenseKey, 
  hashLicenseKey, 
  calculateExpiryDate, 
  isLicenseExpired, 
  getDaysRemaining,
  isExpiringSoon,
  validateLicenseKeyFormat,
  LICENSE_OWNER,
  PLATFORM_NAME,
  PLATFORM_TAGLINE
} = require('../utils/license');

module.exports = (pool) => {
  const router = express.Router();

  // Get license status (public endpoint for frontend checks)
  router.get('/status', async (req, res) => {
    try {
      // Check if in development mode
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DISABLE_LICENSE_CHECK === 'true';
      
      if (isDevelopment) {
        return res.json({
          is_valid: true,
          license_required: false,
          license_expired: false,
          expires_at: null,
          activated_at: null,
          days_remaining: 999,
          is_expiring_soon: false,
          company_name: 'Development Mode',
          contact_email: null,
          platform_name: PLATFORM_NAME,
          platform_tagline: PLATFORM_TAGLINE,
          owner: LICENSE_OWNER,
          dev_mode: true
        });
      }

      const result = await pool.query(
        `SELECT * FROM licenses 
         WHERE is_active = true 
         ORDER BY activated_at DESC 
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return res.json({
          is_valid: false,
          license_required: true,
          message: 'No license found. Please activate a license.',
          platform_name: PLATFORM_NAME,
          platform_tagline: PLATFORM_TAGLINE,
          owner: LICENSE_OWNER
        });
      }

      const license = result.rows[0];
      const expired = isLicenseExpired(license.expires_at);
      const daysRemaining = getDaysRemaining(license.expires_at);

      res.json({
        is_valid: !expired,
        license_required: false,
        license_expired: expired,
        expires_at: license.expires_at,
        activated_at: license.activated_at,
        days_remaining: daysRemaining,
        is_expiring_soon: isExpiringSoon(license.expires_at),
        company_name: license.company_name,
        contact_email: license.contact_email,
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      console.error('Error fetching license status:', error);
      res.status(500).json({ error: 'Failed to fetch license status' });
    }
  });

  // Get license information (admin only)
  router.get('/info', requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, company_name, contact_email, contact_phone, 
                activated_at, expires_at, is_active, max_users, created_at
         FROM licenses 
         WHERE is_active = true 
         ORDER BY activated_at DESC 
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return res.json({
          license_found: false,
          message: 'No active license found'
        });
      }

      const license = result.rows[0];
      const expired = isLicenseExpired(license.expires_at);
      const daysRemaining = getDaysRemaining(license.expires_at);

      res.json({
        license_found: true,
        ...license,
        is_expired: expired,
        days_remaining: daysRemaining,
        is_expiring_soon: isExpiringSoon(license.expires_at),
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      console.error('Error fetching license info:', error);
      res.status(500).json({ error: 'Failed to fetch license information' });
    }
  });

  // Activate a new license (admin only)
  router.post('/activate', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { license_key, company_name, contact_email, contact_phone, max_users } = req.body;

      if (!license_key || !company_name) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['license_key', 'company_name']
        });
      }

      // Validate license key format
      if (!validateLicenseKeyFormat(license_key)) {
        return res.status(400).json({ 
          error: 'Invalid license key format',
          expected_format: 'SPHAIR-XXXX-XXXX-XXXX-XXXX'
        });
      }

      // Check if license key already exists
      const hashedKey = hashLicenseKey(license_key);
      const existing = await pool.query(
        'SELECT id FROM licenses WHERE license_key = $1',
        [hashedKey]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ 
          error: 'License key already activated',
          message: 'This license key has already been activated. Please use a different key or contact support.'
        });
      }

      // Calculate expiry date (3 months from now)
      const activatedAt = new Date();
      const expiresAt = calculateExpiryDate(activatedAt);

      // Insert new license
      const result = await pool.query(
        `INSERT INTO licenses 
         (license_key, company_name, contact_email, contact_phone, activated_at, expires_at, max_users, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING id, company_name, activated_at, expires_at`,
        [hashedKey, company_name, contact_email || null, contact_phone || null, activatedAt, expiresAt, max_users || null]
      );

      const license = result.rows[0];

      console.log(`[LICENSE] License activated for ${company_name}. Expires: ${expiresAt.toISOString()}`);

      res.status(201).json({
        message: 'License activated successfully',
        license: {
          id: license.id,
          company_name: license.company_name,
          activated_at: license.activated_at,
          expires_at: license.expires_at,
          days_remaining: getDaysRemaining(license.expires_at)
        },
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      console.error('Error activating license:', error);
      res.status(500).json({ error: 'Failed to activate license', details: error.message });
    }
  });

  // Renew an expired license (admin only)
  router.put('/renew', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { license_key } = req.body;

      if (!license_key) {
        return res.status(400).json({ error: 'License key is required' });
      }

      // Validate license key format
      if (!validateLicenseKeyFormat(license_key)) {
        return res.status(400).json({ 
          error: 'Invalid license key format',
          expected_format: 'SPHAIR-XXXX-XXXX-XXXX-XXXX'
        });
      }

      const hashedKey = hashLicenseKey(license_key);

      // Find existing license
      const existing = await pool.query(
        'SELECT * FROM licenses WHERE license_key = $1',
        [hashedKey]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ 
          error: 'License not found',
          message: 'This license key was not found. Please check the key and try again.'
        });
      }

      const license = existing.rows[0];

      // Calculate new expiry date (3 months from now)
      const newExpiresAt = calculateExpiryDate(new Date());

      // Update license
      const result = await pool.query(
        `UPDATE licenses 
         SET expires_at = $1, 
             activated_at = CURRENT_TIMESTAMP,
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, company_name, activated_at, expires_at`,
        [newExpiresAt, license.id]
      );

      const updatedLicense = result.rows[0];

      console.log(`[LICENSE] License renewed for ${updatedLicense.company_name}. New expiry: ${newExpiresAt.toISOString()}`);

      res.json({
        message: 'License renewed successfully',
        license: {
          id: updatedLicense.id,
          company_name: updatedLicense.company_name,
          activated_at: updatedLicense.activated_at,
          expires_at: updatedLicense.expires_at,
          days_remaining: getDaysRemaining(updatedLicense.expires_at)
        },
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      console.error('Error renewing license:', error);
      res.status(500).json({ error: 'Failed to renew license', details: error.message });
    }
  });

  // Generate a new license key (admin only - for testing/development)
  router.post('/generate', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { company_name } = req.body;
      
      if (!company_name) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      const licenseKey = generateLicenseKey(company_name);
      const expiresAt = calculateExpiryDate(new Date());

      res.json({
        license_key: licenseKey,
        expires_at: expiresAt,
        duration_days: 90,
        message: 'License key generated. Use /activate endpoint to activate it.',
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      console.error('Error generating license key:', error);
      res.status(500).json({ error: 'Failed to generate license key' });
    }
  });

  return router;
};
