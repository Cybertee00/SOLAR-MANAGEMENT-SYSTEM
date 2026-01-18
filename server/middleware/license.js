/**
 * License Validation Middleware
 * Checks if the system has a valid, non-expired, non-revoked license
 * Supports both new signed tokens and legacy license keys
 */

const { 
  verifyLicenseToken, 
  decodeLicenseToken,
  isLicenseExpired, 
  getDaysRemaining 
} = require('../utils/license');
const logger = require('../utils/logger');

/**
 * Middleware to check license validity
 * Returns 403 if license is expired, revoked, or invalid
 * SKIPS validation in development mode (NODE_ENV=development or DISABLE_LICENSE_CHECK=true)
 * 
 * Supports:
 * - New signed token format (cryptographically verified)
 * - Legacy license key format (database lookup)
 * - Multi-tenant licenses (company_id filtering)
 * - License revocation checking
 */
function requireValidLicense(pool) {
  return async (req, res, next) => {
    // Skip license check in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DISABLE_LICENSE_CHECK === 'true';
    
    if (isDevelopment) {
      logger.debug('[LICENSE] Development mode: License validation skipped');
      // Add a dev license info to request
      req.license = {
        id: 'dev-mode',
        company_id: null,
        company_name: 'Development Mode',
        tier: 'enterprise',
        expires_at: null,
        days_remaining: 999,
        features: [],
        dev_mode: true
      };
      return next();
    }

    try {
      // Get the active license (optionally filter by company_id for multi-tenant)
      const companyId = req.session?.company_id || null;
      let query;
      let params;

      if (companyId) {
        // Multi-tenant: check license for specific company
        query = `
          SELECT * FROM licenses 
          WHERE is_active = true 
            AND is_revoked = false
            AND (company_id = $1 OR company_id IS NULL)
          ORDER BY activated_at DESC 
          LIMIT 1
        `;
        params = [companyId];
      } else {
        // Single-tenant: get any active license
        query = `
          SELECT * FROM licenses 
          WHERE is_active = true 
            AND is_revoked = false
          ORDER BY activated_at DESC 
          LIMIT 1
        `;
        params = [];
      }

      const result = await pool.query(query, params);

      // No license found
      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'License Required',
          message: 'SPHAiRPlatform requires a valid license to operate. Please contact BRIGHTSTEP TECHNOLOGIES Pty Ltd to activate your license.',
          license_required: true
        });
      }

      const license = result.rows[0];

      // Check if license is revoked
      if (license.is_revoked) {
        logger.warn('[LICENSE] License revoked', { 
          licenseId: license.id, 
          companyName: license.company_name,
          revokedAt: license.revoked_at 
        });
        return res.status(403).json({
          error: 'License Revoked',
          message: `Your SPHAiRPlatform license has been revoked${license.revoked_reason ? `: ${license.revoked_reason}` : ''}. Please contact BRIGHTSTEP TECHNOLOGIES Pty Ltd for assistance.`,
          license_revoked: true,
          revoked_at: license.revoked_at,
          revoked_reason: license.revoked_reason
        });
      }

      // Try to verify license token if present (new format)
      let tokenPayload = null;
      if (license.license_token) {
        tokenPayload = verifyLicenseToken(license.license_token);
        if (tokenPayload) {
          // Token is valid - use data from token (more secure)
          logger.debug('[LICENSE] License validated via signed token', { 
            companyName: tokenPayload.companyName,
            tier: tokenPayload.tier 
          });

          req.license = {
            id: license.id,
            company_id: tokenPayload.companyId || license.company_id,
            company_name: tokenPayload.companyName,
            tier: tokenPayload.tier,
            max_users: tokenPayload.maxUsers,
            features: tokenPayload.features || [],
            license_type: tokenPayload.licenseType,
            expires_at: new Date(tokenPayload.expiresAt),
            days_remaining: getDaysRemaining(new Date(tokenPayload.expiresAt))
          };

          // Check expiry from token
          if (isLicenseExpired(new Date(tokenPayload.expiresAt))) {
            return res.status(403).json({
              error: 'License Expired',
              message: `Your SPHAiRPlatform license expired on ${new Date(tokenPayload.expiresAt).toLocaleDateString()}. Please contact BRIGHTSTEP TECHNOLOGIES Pty Ltd to renew your license.`,
              license_expired: true,
              expires_at: tokenPayload.expiresAt,
              days_remaining: 0
            });
          }

          return next();
        } else {
          // Token verification failed - fall back to database validation
          logger.warn('[LICENSE] Token verification failed, falling back to database validation', { licenseId: license.id });
        }
      }

      // Fall back to database validation (legacy format or token verification failed)
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
        company_id: license.company_id,
        company_name: license.company_name,
        tier: license.license_tier || 'small',
        max_users: license.max_users || 10,
        features: license.features || [],
        license_type: license.license_type || 'subscription',
        expires_at: license.expires_at,
        days_remaining: getDaysRemaining(license.expires_at)
      };

      next();
    } catch (error) {
      logger.error('[LICENSE] Error checking license', { error: error.message, stack: error.stack });
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
        tier: 'enterprise',
        features: [],
        is_expiring_soon: false,
        dev_mode: true
      };
      return next();
    }

    try {
      const companyId = req.session?.company_id || null;
      let query;
      let params;

      if (companyId) {
        query = `
          SELECT * FROM licenses 
          WHERE is_active = true 
            AND is_revoked = false
            AND (company_id = $1 OR company_id IS NULL)
          ORDER BY activated_at DESC 
          LIMIT 1
        `;
        params = [companyId];
      } else {
        query = `
          SELECT * FROM licenses 
          WHERE is_active = true 
            AND is_revoked = false
          ORDER BY activated_at DESC 
          LIMIT 1
        `;
        params = [];
      }

      const result = await pool.query(query, params);

      if (result.rows.length > 0) {
        const license = result.rows[0];
        
        // Try token verification first
        let tokenPayload = null;
        if (license.license_token) {
          tokenPayload = verifyLicenseToken(license.license_token);
        }

        const expiresAt = tokenPayload 
          ? new Date(tokenPayload.expiresAt) 
          : license.expires_at;
        const companyName = tokenPayload 
          ? tokenPayload.companyName 
          : license.company_name;
        const tier = tokenPayload 
          ? tokenPayload.tier 
          : (license.license_tier || 'small');
        const features = tokenPayload 
          ? tokenPayload.features 
          : (license.features || []);

        req.licenseStatus = {
          is_valid: !isLicenseExpired(expiresAt),
          expires_at: expiresAt,
          days_remaining: getDaysRemaining(expiresAt),
          company_name: companyName,
          tier: tier,
          features: features,
          is_expiring_soon: getDaysRemaining(expiresAt) <= 30
        };
      } else {
        req.licenseStatus = {
          is_valid: false,
          license_required: true
        };
      }
    } catch (error) {
      logger.error('[LICENSE] Error checking license status', { error: error.message });
    }
    next();
  };
}

module.exports = {
  requireValidLicense,
  checkLicenseStatus
};
