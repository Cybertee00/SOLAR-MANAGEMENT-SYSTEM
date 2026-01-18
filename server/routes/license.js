/**
 * License Management Routes
 * Handles license activation, status checks, and renewal
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { 
  generateLicenseToken,
  generateLicenseKey, 
  verifyLicenseToken,
  decodeLicenseToken,
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
const logger = require('../utils/logger');

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
      logger.error('Error fetching license status', { error: error.message, stack: error.stack });
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
      logger.error('Error fetching license info', { error: error.message, stack: error.stack });
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

      // Validate license key/token format
      if (!validateLicenseKeyFormat(license_key)) {
        return res.status(400).json({ 
          error: 'Invalid license key format',
          expected_format: 'SPHAIR-XXXX-XXXX-XXXX-XXXX or signed token format'
        });
      }

      // Try to verify if it's a signed token (new format)
      let tokenPayload = null;
      let licenseToken = license_key;
      let expiresAt;
      let issuedAt;

      if (license_key.includes('.')) {
        // New token format - verify signature
        tokenPayload = verifyLicenseToken(license_key);
        if (!tokenPayload) {
          return res.status(400).json({
            error: 'Invalid license token',
            message: 'License token signature verification failed. Please ensure you have the correct license token.'
          });
        }
        // Use data from token
        expiresAt = new Date(tokenPayload.expiresAt);
        issuedAt = new Date(tokenPayload.issuedAt);
        
        // Override company_name from token if provided
        if (tokenPayload.companyName && tokenPayload.companyName !== company_name) {
          logger.warn('[LICENSE] Company name mismatch', {
            tokenCompanyName: tokenPayload.companyName,
            providedCompanyName: company_name
          });
          // Use company name from token (more secure)
          company_name = tokenPayload.companyName;
        }
      } else {
        // Legacy format - calculate expiry
        const activatedAt = new Date();
        expiresAt = calculateExpiryDate(activatedAt);
        issuedAt = activatedAt;
      }

      // Check if license key/token already exists
      const hashedKey = hashLicenseKey(license_key);
      const existing = await pool.query(
        'SELECT id FROM licenses WHERE license_key = $1 OR license_token = $2',
        [hashedKey, license_key]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ 
          error: 'License already activated',
          message: 'This license has already been activated. Please use a different license or contact support.'
        });
      }

      // Extract tier and features from token if available
      const tier = tokenPayload ? tokenPayload.tier : req.body.tier || 'small';
      const maxUsers = tokenPayload ? tokenPayload.maxUsers : (max_users || 10);
      const features = tokenPayload ? tokenPayload.features : (req.body.features || []);
      const licenseType = tokenPayload ? tokenPayload.licenseType : (req.body.license_type || 'subscription');
      const companyId = tokenPayload ? tokenPayload.companyId : (req.body.company_id || null);

      // Insert new license
      const result = await pool.query(
        `INSERT INTO licenses 
         (license_key, license_token, company_id, company_name, contact_email, contact_phone, 
          license_tier, license_type, max_users, features, 
          issued_at, activated_at, expires_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
         RETURNING id, company_name, activated_at, expires_at, license_tier`,
        [
          hashedKey,           // license_key (hashed for indexing)
          licenseToken || null, // license_token (full token if new format)
          companyId,           // company_id (for multi-tenant)
          company_name,        // company_name
          contact_email || null,
          contact_phone || null,
          tier,                // license_tier
          licenseType,         // license_type
          maxUsers,            // max_users
          JSON.stringify(features), // features (JSONB)
          issuedAt,            // issued_at
          new Date(),          // activated_at
          expiresAt,           // expires_at
        ]
      );

      const license = result.rows[0];

      logger.info('[LICENSE] License activated', {
        companyName: license.company_name,
        tier: license.license_tier,
        expiresAt: license.expires_at.toISOString(),
        tokenFormat: tokenPayload ? 'signed' : 'legacy'
      });

      res.status(201).json({
        message: 'License activated successfully',
        license: {
          id: license.id,
          company_name: license.company_name,
          tier: license.license_tier,
          activated_at: license.activated_at,
          expires_at: license.expires_at,
          days_remaining: getDaysRemaining(license.expires_at)
        },
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      logger.error('Error activating license', { error: error.message, stack: error.stack });
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

      logger.info('[LICENSE] License renewed', {
        companyName: updatedLicense.company_name,
        newExpiresAt: newExpiresAt.toISOString()
      });

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
      logger.error('Error renewing license', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Failed to renew license', details: error.message });
    }
  });

  // Generate a new license token (admin only - for BRIGHTSTEP use)
  router.post('/generate', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { 
        company_name, 
        company_id,
        tier = 'small', 
        max_users = 10, 
        features = [],
        license_type = 'subscription',
        duration_days = 90 
      } = req.body;
      
      if (!company_name) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      // Generate signed license token (new format)
      const licenseToken = generateLicenseToken({
        companyId: company_id,
        companyName: company_name,
        tier: tier,
        maxUsers: max_users,
        features: features,
        licenseType: license_type,
        durationDays: duration_days
      });

      // Decode to get expiry info
      const tokenPayload = decodeLicenseToken(licenseToken);
      const expiresAt = tokenPayload ? new Date(tokenPayload.expiresAt) : calculateExpiryDate(new Date(), duration_days);

      // Also generate human-readable key for backward compatibility
      const licenseKey = generateLicenseKey(company_name);

      logger.info('[LICENSE] License token generated', {
        companyName: company_name,
        tier: tier,
        expiresAt: expiresAt.toISOString()
      });

      res.json({
        license_token: licenseToken,
        license_key: licenseKey, // Human-readable key (backward compatibility)
        expires_at: expiresAt,
        duration_days: duration_days,
        tier: tier,
        max_users: max_users,
        features: features,
        license_type: license_type,
        message: 'License token generated. Use /activate endpoint to activate it.',
        note: 'The license_token (signed format) is recommended for production use.',
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      logger.error('Error generating license token', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Failed to generate license token', details: error.message });
    }
  });

  // Revoke a license (admin only - for BRIGHTSTEP use)
  router.post('/revoke', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { license_id, reason } = req.body;
      
      if (!license_id) {
        return res.status(400).json({ error: 'License ID is required' });
      }

      // Find license
      const existing = await pool.query(
        'SELECT * FROM licenses WHERE id = $1',
        [license_id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ 
          error: 'License not found',
          message: 'License with the provided ID was not found.'
        });
      }

      const license = existing.rows[0];

      if (license.is_revoked) {
        return res.status(400).json({
          error: 'License already revoked',
          message: 'This license is already revoked.',
          revoked_at: license.revoked_at,
          revoked_reason: license.revoked_reason
        });
      }

      // Revoke license
      const result = await pool.query(
        `UPDATE licenses 
         SET is_revoked = true,
             revoked_at = CURRENT_TIMESTAMP,
             revoked_reason = $1,
             is_active = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, company_name, revoked_at, revoked_reason`,
        [reason || null, license_id]
      );

      const revokedLicense = result.rows[0];

      logger.warn('[LICENSE] License revoked', {
        licenseId: revokedLicense.id,
        companyName: revokedLicense.company_name,
        reason: revokedLicense.revoked_reason
      });

      res.json({
        message: 'License revoked successfully',
        license: {
          id: revokedLicense.id,
          company_name: revokedLicense.company_name,
          revoked_at: revokedLicense.revoked_at,
          revoked_reason: revokedLicense.revoked_reason
        },
        platform_name: PLATFORM_NAME,
        platform_tagline: PLATFORM_TAGLINE,
        owner: LICENSE_OWNER
      });
    } catch (error) {
      logger.error('Error revoking license', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Failed to revoke license', details: error.message });
    }
  });

  return router;
};
