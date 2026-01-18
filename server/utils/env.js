/**
 * Environment Utility
 * 
 * Provides environment detection and configuration helpers
 */

/**
 * Check if running in production environment
 * @returns {boolean}
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development environment
 * @returns {boolean}
 */
function isDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if running in test environment
 * @returns {boolean}
 */
function isTest() {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get environment name
 * @returns {string} 'production' | 'development' | 'test'
 */
function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

/**
 * Get environment variable with default value
 * @param {string} key - Environment variable name
 * @param {any} defaultValue - Default value if not set
 * @returns {any}
 */
function getEnv(key, defaultValue = undefined) {
  return process.env[key] !== undefined ? process.env[key] : defaultValue;
}

/**
 * Get environment variable as integer
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
function getEnvInt(key, defaultValue = 0) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get environment variable as boolean
 * @param {string} key - Environment variable name
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
function getEnvBool(key, defaultValue = false) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return Boolean(value);
}

module.exports = {
  isProduction,
  isDevelopment,
  isTest,
  getEnvironment,
  getEnv,
  getEnvInt,
  getEnvBool
};
