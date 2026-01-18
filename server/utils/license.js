/**
 * License Management Utilities
 * Handles license token generation, validation, and cryptographic signing
 * 
 * Uses industry-standard signed token approach (JWT-style):
 * - Header.Payload.Signature format
 * - HMAC-SHA256 cryptographic signing
 * - License data encoded in payload
 * - Offline validation capability
 */

const crypto = require('crypto');
const logger = require('./logger');
const { getEnv } = require('./env');

const LICENSE_OWNER = 'BRIGHTSTEP TECHNOLOGIES Pty Ltd';
const PLATFORM_NAME = 'SPHAiRPlatform';
const PLATFORM_TAGLINE = 'One Platform. Every Task.';
const LICENSE_DURATION_DAYS = 90; // 3 months

// Get signing secret from environment (required for production)
const LICENSE_SIGNING_SECRET = getEnv('LICENSE_SIGNING_SECRET') || getEnv('SESSION_SECRET') || 'CHANGE-THIS-SECRET-IN-PRODUCTION';

/**
 * Base64URL encoding (JWT standard)
 * Converts + to -, / to _, removes padding =
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decoding
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString();
}

/**
 * Generate a cryptographically signed license token
 * 
 * Token Format: header.payload.signature
 * - Header: Algorithm and type (JSON, base64url encoded)
 * - Payload: License data (JSON, base64url encoded)
 * - Signature: HMAC-SHA256(header.payload, secret) (base64url encoded)
 * 
 * @param {Object} licenseData - License information
 * @param {string} licenseData.companyId - Company UUID (optional, for multi-tenant)
 * @param {string} licenseData.companyName - Company name
 * @param {string} licenseData.tier - License tier (small/medium/large/enterprise)
 * @param {number} licenseData.maxUsers - Maximum users allowed
 * @param {Array<string>} licenseData.features - Enabled features (optional)
 * @param {string} licenseData.licenseType - License type (trial/subscription/perpetual)
 * @param {number} licenseData.durationDays - License duration in days (default: 90)
 * @param {Date} licenseData.issuedAt - Issue timestamp (default: now)
 * @returns {string} Signed license token
 */
function generateLicenseToken(licenseData) {
  const now = licenseData.issuedAt ? new Date(licenseData.issuedAt).getTime() : Date.now();
  const duration = licenseData.durationDays || LICENSE_DURATION_DAYS;
  const expiresAt = new Date(now + (duration * 24 * 60 * 60 * 1000));

  // Header: Algorithm and type
  const header = {
    alg: 'HS256',
    typ: 'LICENSE'
  };

  // Payload: License information
  const payload = {
    company_id: licenseData.companyId || null,
    company_name: licenseData.companyName,
    tier: licenseData.tier || 'small',
    max_users: licenseData.maxUsers || 10,
    features: licenseData.features || [],
    license_type: licenseData.licenseType || 'subscription',
    issued_at: now,
    expires_at: expiresAt.getTime()
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature: HMAC-SHA256(header.payload, secret)
  const signature = crypto
    .createHmac('sha256', LICENSE_SIGNING_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Combine: header.payload.signature
  const token = `${encodedHeader}.${encodedPayload}.${signature}`;

  logger.debug('License token generated', { 
    companyName: licenseData.companyName,
    tier: payload.tier,
    expiresAt: expiresAt.toISOString()
  });

  return token;
}

/**
 * Verify and decode a license token
 * 
 * @param {string} token - License token to verify
 * @returns {Object} Decoded license payload or null if invalid
 * @returns {string} returns.companyId - Company ID (if provided)
 * @returns {string} returns.companyName - Company name
 * @returns {string} returns.tier - License tier
 * @returns {number} returns.maxUsers - Maximum users
 * @returns {Array} returns.features - Enabled features
 * @returns {string} returns.licenseType - License type
 * @returns {number} returns.issuedAt - Issue timestamp
 * @returns {number} returns.expiresAt - Expiry timestamp
 */
function verifyLicenseToken(token) {
  if (!token || typeof token !== 'string') {
    logger.warn('License token verification failed: token is missing or invalid type');
    return null;
  }

  try {
    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      logger.warn('License token verification failed: invalid token format', { parts: parts.length });
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', LICENSE_SIGNING_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    if (signature !== expectedSignature) {
      logger.warn('License token verification failed: invalid signature');
      return null;
    }

    // Decode payload
    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson);

    // Verify expiry
    const now = Date.now();
    if (payload.expires_at && payload.expires_at < now) {
      logger.warn('License token verification failed: token expired', { 
        expiresAt: new Date(payload.expires_at).toISOString() 
      });
      return null;
    }

    // Return decoded payload
    return {
      companyId: payload.company_id,
      companyName: payload.company_name,
      tier: payload.tier,
      maxUsers: payload.max_users,
      features: payload.features || [],
      licenseType: payload.license_type,
      issuedAt: payload.issued_at,
      expiresAt: payload.expires_at
    };
  } catch (error) {
    logger.error('License token verification error', { error: error.message });
    return null;
  }
}

/**
 * Generate a human-readable license key (backward compatibility)
 * Format: SPHAIR-XXXX-XXXX-XXXX-XXXX-XXXX (from token hash)
 * 
 * @param {string} companyName - Company name
 * @returns {string} Human-readable license key
 */
function generateLicenseKey(companyName) {
  // Generate a signed token first
  const token = generateLicenseToken({
    companyName: companyName,
    tier: 'small',
    maxUsers: 10
  });

  // Create human-readable key from token hash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const segments = [
    tokenHash.substring(0, 4),
    tokenHash.substring(4, 8),
    tokenHash.substring(8, 12),
    tokenHash.substring(12, 16),
    tokenHash.substring(16, 20)
  ].map(s => s.toUpperCase());

  return `SPHAIR-${segments.join('-')}`;
}

/**
 * Hash a license key/token for database storage (indexing/lookup)
 */
function hashLicenseKey(licenseKeyOrToken) {
  return crypto.createHash('sha256').update(licenseKeyOrToken).digest('hex');
}

/**
 * Calculate expiry date from activation date
 */
function calculateExpiryDate(activatedAt = new Date(), durationDays = LICENSE_DURATION_DAYS) {
  const expiry = new Date(activatedAt);
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry;
}

/**
 * Check if license is expired
 */
function isLicenseExpired(expiresAt) {
  if (!expiresAt) return true;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry < new Date();
}

/**
 * Get days remaining until expiry
 */
function getDaysRemaining(expiresAt) {
  if (!expiresAt) return 0;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const now = new Date();
  const diff = expiry - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Check if license is expiring soon (within 30 days)
 */
function isExpiringSoon(expiresAt) {
  return getDaysRemaining(expiresAt) <= 30 && getDaysRemaining(expiresAt) > 0;
}

/**
 * Validate license key/token format
 * Accepts both old format (SPHAIR-XXXX-XXXX-XXXX-XXXX) and new token format
 */
function validateLicenseKeyFormat(licenseKeyOrToken) {
  if (!licenseKeyOrToken || typeof licenseKeyOrToken !== 'string') return false;
  
  // Check for new token format (header.payload.signature)
  if (licenseKeyOrToken.includes('.')) {
    const parts = licenseKeyOrToken.split('.');
    return parts.length === 3;
  }
  
  // Check for old format (SPHAIR-XXXX-XXXX-XXXX-XXXX)
  const oldPattern = /^SPHAIR-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}(-[A-F0-9]{4})?$/i;
  return oldPattern.test(licenseKeyOrToken);
}

/**
 * Extract license information from token (without verification)
 * Useful for displaying license info before activation
 */
function decodeLicenseToken(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);

    return {
      companyId: payload.company_id,
      companyName: payload.company_name,
      tier: payload.tier,
      maxUsers: payload.max_users,
      features: payload.features || [],
      licenseType: payload.license_type,
      issuedAt: payload.issued_at,
      expiresAt: payload.expires_at
    };
  } catch (error) {
    logger.debug('Failed to decode license token', { error: error.message });
    return null;
  }
}

module.exports = {
  LICENSE_OWNER,
  PLATFORM_NAME,
  PLATFORM_TAGLINE,
  LICENSE_DURATION_DAYS,
  // New token-based functions
  generateLicenseToken,
  verifyLicenseToken,
  decodeLicenseToken,
  // Backward compatibility functions
  generateLicenseKey,
  hashLicenseKey,
  calculateExpiryDate,
  isLicenseExpired,
  getDaysRemaining,
  isExpiringSoon,
  validateLicenseKeyFormat
};
