/**
 * Error Message Mapping Utility
 * Maps technical errors to brief, user-friendly messages
 */

const ERROR_MESSAGES = {
  // Network errors
  'ECONNREFUSED': 'Connection failed',
  'ENOTFOUND': 'Service unavailable',
  'ETIMEDOUT': 'Connection timeout',
  'ECONNABORTED': 'Request timeout',
  'Network Error': 'Connection failed',
  'Failed to fetch': 'Connection failed',
  
  // Database errors (PostgreSQL)
  '23505': 'Already exists',
  '23503': 'Invalid reference',
  '23502': 'Required field missing',
  '42P01': 'Resource not found',
  
  // HTTP status codes
  '400': 'Invalid request',
  '401': 'Authentication required',
  '403': 'Access denied',
  '404': 'Not found',
  '409': 'Conflict',
  '500': 'Service unavailable',
  '503': 'Service unavailable',
  
  // Common error patterns
  'timeout': 'Request timeout',
  'network': 'Connection failed',
  'unauthorized': 'Authentication required',
  'forbidden': 'Access denied',
  'not found': 'Not found',
  'already exists': 'Already exists',
  'invalid': 'Invalid input',
  'required': 'Required field missing',
  'permission': 'Access denied',
  'access restricted': 'Access restricted'
};

/**
 * Simplifies error message to be brief and user-friendly
 * @param {string} message - Original error message
 * @returns {string} Simplified message
 */
function simplifyErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'Operation failed';
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Check for exact matches first
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Remove common prefixes
  let simplified = message
    .replace(/^(failed to|error:|error|failed):?\s*/i, '')
    .replace(/^(unable to|cannot|could not):?\s*/i, '')
    .replace(/^(please|kindly):?\s*/i, '')
    .trim();
  
  // If message is still too long, take first sentence or first 50 chars
  if (simplified.length > 50) {
    const firstSentence = simplified.split(/[.!?]/)[0];
    if (firstSentence.length > 0 && firstSentence.length <= 50) {
      simplified = firstSentence.trim();
    } else {
      simplified = simplified.substring(0, 47).trim() + '...';
    }
  }
  
  // Capitalize first letter
  if (simplified.length > 0) {
    simplified = simplified.charAt(0).toUpperCase() + simplified.slice(1);
  }
  
  return simplified || 'Operation failed';
}

/**
 * Maps database error codes to user-friendly messages
 * @param {Error} error - Database error
 * @returns {string} User-friendly message
 */
function mapDatabaseError(error) {
  if (!error) return 'Operation failed';
  
  // Check PostgreSQL error code
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  
  // Check error message
  if (error.message) {
    return simplifyErrorMessage(error.message);
  }
  
  return 'Operation failed';
}

module.exports = {
  simplifyErrorMessage,
  mapDatabaseError,
  ERROR_MESSAGES
};
