/**
 * License Validation Middleware
 * Checks if the system has a valid, non-expired license
 */

const { isLicenseExpired, getDaysRemaining } = require('../utils/license');

/**
 * Middleware to check license validity
 * Returns 403 if license is expired or invalid
 * SKIPS validation in development mode (NODE_ENV=development or DISABLE_LICENSE_CHECK=true)
 */
function requireValidLicense(pool) {
  return async (req, res, next) => {
    // Skip license check in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DISABLE_LICENSE_CHECK === 'true';
    
    if (isDevelopment) {
      console.log('[LICENSE] Development mode: License validation skipped');
      // Add a dev license info to request
      req.license = {
        id: 'dev-mode',
        company_name: 'Development Mode',
        expires_at: null,
        days_remaining: 999,
        dev_mode: true
      };
      return next();
    }

    try {
      // Get the active license
      const result = await pool.query(
        `SELECT * FROM licenses 
         WHERE is_active = true 
         ORDER BY activated_at DESC 
         LIMIT 1`
      );

      // No license found
      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'License Required',
          message: 'SPHAiRPlatform requires a valid license to operate. Please contact BRIGHTSTEP TECHNOLOGIES Pty Ltd to activate your license.',
          license_required: true
        });
      }

      const license = result.rows[0];

      // Check if license is expired
      if (isLicenseExpired(license.expires_at)) {
        return res.status(403).json({
          error: 'License Expired',
          message: `Your SPHAiRPlatform license expired on ${new Date(license.expires_at).toLocaleDateString()}. Please contact BRIGHTSTEP TECHNOLOGIES Pty Ltd to renew your license.`,
          license_expired: true,
          expires_at: license.expires_at,
          days_remaining: 0
        });
      }

      // License is valid - add info to request for logging
      req.license = {
        id: license.id,
        company_name: license.company_name,
        expires_at: license.expires_at,
        days_remaining: getDaysRemaining(license.expires_at)
      };

      next();
    } catch (error) {
      console.error('[LICENSE] Error checking license:', error);
      // On error, allow request but log it
      // This prevents system lockout due to database issues
      next();
    }
  };
}

/**
 * Middleware to check license status (non-blocking)
 * Adds license info to request but doesn't block if expired
 * Returns dev mode status in development
 */
function checkLicenseStatus(pool) {
  return async (req, res, next) => {
    // Skip license check in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DISABLE_LICENSE_CHECK === 'true';
    
    if (isDevelopment) {
      req.licenseStatus = {
        is_valid: true,
        expires_at: null,
        days_remaining: 999,
        company_name: 'Development Mode',
        is_expiring_soon: false,
        dev_mode: true
      };
      return next();
    }

    try {
      const result = await pool.query(
        `SELECT * FROM licenses 
         WHERE is_active = true 
         ORDER BY activated_at DESC 
         LIMIT 1`
      );

      if (result.rows.length > 0) {
        const license = result.rows[0];
        req.licenseStatus = {
          is_valid: !isLicenseExpired(license.expires_at),
          expires_at: license.expires_at,
          days_remaining: getDaysRemaining(license.expires_at),
          company_name: license.company_name,
          is_expiring_soon: getDaysRemaining(license.expires_at) <= 30
        };
      } else {
        req.licenseStatus = {
          is_valid: false,
          license_required: true
        };
      }
    } catch (error) {
      console.error('[LICENSE] Error checking license status:', error);
    }
    next();
  };
}

module.exports = {
  requireValidLicense,
  checkLicenseStatus
};
