/**
 * Jest Test Setup
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'solar_om_db_test';
process.env.SESSION_SECRET = 'test-session-secret-for-jest-tests-only';
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-tests-only';
process.env.LICENSE_SIGNING_SECRET = 'test-license-secret-for-jest-tests-only';
process.env.REDIS_ENABLED = 'false'; // Disable Redis in tests unless explicitly testing Redis
process.env.DISABLE_LICENSE_CHECK = 'true'; // Disable license checks in tests

// Suppress console output during tests (use logger instead)
// Uncomment if you want to see all console output:
// process.env.DEBUG = 'true';
