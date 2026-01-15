/**
 * License Management Utilities
 * Handles license validation, expiry checks, and license key generation
 */

const crypto = require('crypto');

const LICENSE_OWNER = 'BRIGHTSTEP TECHNOLOGIES Pty Ltd';
const PLATFORM_NAME = 'SPHAiRPlatform';
const PLATFORM_TAGLINE = 'One Platform. Every Task.';
const LICENSE_DURATION_DAYS = 90; // 3 months

/**
 * Generate a license key
 * Format: SPHAIR-XXXX-XXXX-XXXX-XXXX
 */
function generateLicenseKey(companyName) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const companyHash = crypto.createHash('md5').update(companyName).digest('hex').substring(0, 8);
  const combined = `${timestamp}-${random}-${companyHash}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  
  // Format as SPHAIR-XXXX-XXXX-XXXX-XXXX
  const segments = [
    hash.substring(0, 4),
    hash.substring(4, 8),
    hash.substring(8, 12),
    hash.substring(12, 16)
  ].map(s => s.toUpperCase());
  
  return `SPHAIR-${segments.join('-')}`;
}

/**
 * Hash a license key for storage
 */
function hashLicenseKey(licenseKey) {
  return crypto.createHash('sha256').update(licenseKey).digest('hex');
}

/**
 * Calculate expiry date from activation date
 */
function calculateExpiryDate(activatedAt = new Date()) {
  const expiry = new Date(activatedAt);
  expiry.setDate(expiry.getDate() + LICENSE_DURATION_DAYS);
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
 * Validate license key format
 */
function validateLicenseKeyFormat(licenseKey) {
  if (!licenseKey || typeof licenseKey !== 'string') return false;
  const pattern = /^SPHAIR-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/i;
  return pattern.test(licenseKey);
}

module.exports = {
  LICENSE_OWNER,
  PLATFORM_NAME,
  PLATFORM_TAGLINE,
  LICENSE_DURATION_DAYS,
  generateLicenseKey,
  hashLicenseKey,
  calculateExpiryDate,
  isLicenseExpired,
  getDaysRemaining,
  isExpiringSoon,
  validateLicenseKeyFormat
};
