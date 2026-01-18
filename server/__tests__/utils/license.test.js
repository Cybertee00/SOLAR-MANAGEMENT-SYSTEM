/**
 * License Utility Tests
 * Tests for license token generation and verification
 */

const {
  generateLicenseToken,
  verifyLicenseToken,
  isLicenseExpired,
  getDaysRemaining
} = require('../../utils/license');

describe('License Token Generation and Verification', () => {
  const mockPayload = {
    companyId: 'test-company-id',
    companyName: 'Test Company',
    tier: 'small',
    maxUsers: 10,
    features: ['white_labeling'],
    licenseType: 'subscription',
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
  };

  describe('generateLicenseToken', () => {
    test('should generate a valid token', () => {
      const token = generateLicenseToken(mockPayload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      // Token should have 3 parts (header.payload.signature)
      expect(token.split('.').length).toBe(3);
    });

    test('should generate different tokens for different payloads', () => {
      const token1 = generateLicenseToken(mockPayload);
      const payload2 = { ...mockPayload, companyName: 'Different Company' };
      const token2 = generateLicenseToken(payload2);
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyLicenseToken', () => {
    test('should verify a valid token', () => {
      const token = generateLicenseToken(mockPayload);
      const verified = verifyLicenseToken(token);
      expect(verified).toBeTruthy();
      expect(verified.companyName).toBe(mockPayload.companyName);
      expect(verified.tier).toBe(mockPayload.tier);
    });

    test('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const verified = verifyLicenseToken(invalidToken);
      expect(verified).toBeNull();
    });

    test('should return null for tampered token', () => {
      const token = generateLicenseToken(mockPayload);
      const parts = token.split('.');
      // Tamper with payload
      parts[1] = Buffer.from(JSON.stringify({ ...mockPayload, tier: 'enterprise' })).toString('base64url');
      const tamperedToken = parts.join('.');
      const verified = verifyLicenseToken(tamperedToken);
      expect(verified).toBeNull();
    });

    test('should return null for malformed token', () => {
      const malformedToken = 'not.a.valid.token.format';
      const verified = verifyLicenseToken(malformedToken);
      expect(verified).toBeNull();
    });
  });

  describe('isLicenseExpired', () => {
    test('should return false for future expiry date', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      expect(isLicenseExpired(futureDate)).toBe(false);
    });

    test('should return true for past expiry date', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      expect(isLicenseExpired(pastDate)).toBe(true);
    });
  });

  describe('getDaysRemaining', () => {
    test('should calculate days remaining correctly', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const days = getDaysRemaining(futureDate);
      expect(days).toBeGreaterThanOrEqual(29); // Allow for small time differences
      expect(days).toBeLessThanOrEqual(31);
    });

    test('should return 0 for expired license', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const days = getDaysRemaining(pastDate);
      expect(days).toBe(0);
    });
  });
});
