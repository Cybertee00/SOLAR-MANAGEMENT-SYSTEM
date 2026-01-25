/**
 * Error Handling Utility
 * 
 * Provides consistent error message extraction across the application.
 * Handles various error formats from API responses, network errors, and exceptions.
 * 
 * @example
 * const errorMessage = getErrorMessage(error);
 * const errorMessage = getErrorMessage(error, 'Default message');
 */

/**
 * Safely extracts error message from various error formats
 * 
 * @param {any} error - Error object, string, or API response
 * @param {string} defaultMessage - Default message if error cannot be extracted
 * @returns {string} Extracted error message
 * 
 * @example
 * // Axios error
 * getErrorMessage(axiosError) // "Invalid credentials"
 * 
 * // String error
 * getErrorMessage("Something went wrong") // "Something went wrong"
 * 
 * // Error object
 * getErrorMessage(new Error("Network error")) // "Network error"
 * 
 * // API response
 * getErrorMessage({ response: { data: { error: "Not found" } } }) // "Not found"
 */
/**
 * Maps HTTP status codes to user-friendly messages
 */
function getStatusMessage(statusCode) {
  const statusMessages = {
    400: 'Please check your entries and try again',
    401: 'Incorrect password',
    403: 'Access denied',
    404: 'Not found',
    409: 'Already exists',
    422: 'Please check your entries and try again',
    429: 'Too many requests. Please try again later',
    500: 'Server error. Please try again',
    502: 'Service unavailable. Please try again later',
    503: 'Service unavailable. Please try again later',
    504: 'Request timeout. Please try again'
  };
  
  return statusMessages[statusCode] || null;
}

/**
 * Simplifies error message to be brief and user-friendly
 */
function simplifyMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'Something went wrong. Please try again';
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Check for HTTP status code patterns first
  const statusCodeMatch = lowerMessage.match(/status code (\d{3})/);
  if (statusCodeMatch) {
    const statusCode = parseInt(statusCodeMatch[1], 10);
    const statusMessage = getStatusMessage(statusCode);
    if (statusMessage) {
      return statusMessage;
    }
  }
  
  // Check for "Request failed with status code" pattern
  if (lowerMessage.includes('request failed with status code')) {
    const codeMatch = lowerMessage.match(/status code (\d{3})/);
    if (codeMatch) {
      const statusCode = parseInt(codeMatch[1], 10);
      const statusMessage = getStatusMessage(statusCode);
      if (statusMessage) {
        return statusMessage;
      }
    }
    return 'Request failed. Please try again';
  }
  
  // Common error patterns - using plain, user-friendly language
  const patterns = {
    'connection failed': 'Connection failed. Please check your internet',
    'connection timeout': 'Connection timeout. Please try again',
    'request timeout': 'Request timeout. Please try again',
    'service unavailable': 'Service unavailable. Please try again later',
    'access denied': 'Access denied',
    'authentication required': 'Please sign in',
    'invalid credentials': 'Incorrect password',
    'incorrect password': 'Incorrect password',
    'wrong password': 'Incorrect password',
    'password incorrect': 'Incorrect password',
    'not found': 'Not found',
    'already exists': 'Already exists',
    'invalid': 'Please check your entries and try again',
    'required': 'Please fill in all required fields',
    'permission': 'Access denied',
    'access restricted': 'Access restricted',
    'failed to fetch': 'Connection failed. Please check your internet',
    'network error': 'Connection failed. Please check your internet',
    'econnrefused': 'Connection failed. Please check your internet',
    'enotfound': 'Service unavailable. Please try again later',
    'etimedout': 'Connection timeout. Please try again',
    'econnaborted': 'Request timeout. Please try again',
    'unauthorized': 'Incorrect password',
    'forbidden': 'Access denied',
    'bad request': 'Please check your entries and try again',
    'internal server error': 'Server error. Please try again',
    'login failed': 'Incorrect password',
    'authentication failed': 'Incorrect password',
    'invalid username': 'Username not found',
    'invalid email': 'Email address not found',
    'username not found': 'Username not found',
    'user not found': 'User not found',
    'email not found': 'Email not found'
  };
  
  // Check for pattern matches
  for (const [pattern, replacement] of Object.entries(patterns)) {
    if (lowerMessage.includes(pattern)) {
      return replacement;
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
  
  return simplified || 'Something went wrong. Please try again';
}

export function getErrorMessage(error, defaultMessage = 'Something went wrong. Please try again') {
  // Handle null/undefined
  if (!error) {
    return defaultMessage;
  }

  // Handle API response errors (Axios format) - CHECK STATUS CODE FIRST
  if (error.response) {
    const statusCode = error.response.status;
    const data = error.response.data;
    
    // Check HTTP status code first - most reliable
    const statusMessage = getStatusMessage(statusCode);
    if (statusMessage) {
      // If backend provides a user-friendly error message, use it
      if (data?.error && typeof data.error === 'string' && data.error.length < 50) {
        const simplified = simplifyMessage(data.error);
        // Only use backend message if it's not a technical error
        if (!simplified.toLowerCase().includes('status code') && 
            !simplified.toLowerCase().includes('request failed')) {
          return simplified;
        }
      }
      return statusMessage;
    }
    
    // Check for error field (most common)
    if (data?.error) {
      if (typeof data.error === 'string') {
        return simplifyMessage(data.error);
      }
      // If error is an object, try to get message
      if (data.error?.message) {
        return simplifyMessage(data.error.message);
      }
    }
    
    // Check for message field
    if (data?.message) {
      if (typeof data.message === 'string') {
        return simplifyMessage(data.message);
      }
    }
    
    // If we have a status code but no message, use status code mapping
    if (statusCode) {
      return statusMessage || defaultMessage;
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return simplifyMessage(error);
  }

  // Handle Error instances
  if (error instanceof Error) {
    return simplifyMessage(error.message || defaultMessage);
  }

  // Handle error object with message property
  if (error.message) {
    if (typeof error.message === 'string') {
      return simplifyMessage(error.message);
    }
  }

  // Handle error object with error property
  if (error.error) {
    if (typeof error.error === 'string') {
      return simplifyMessage(error.error);
    }
    if (error.error?.message) {
      return simplifyMessage(error.error.message);
    }
  }

  // Fallback: try to convert to string
  try {
    const stringified = String(error);
    // If it's not just "[object Object]", return it
    if (stringified !== '[object Object]') {
      return simplifyMessage(stringified);
    }
  } catch (e) {
    // Ignore conversion errors
  }

  return defaultMessage;
}

/**
 * Checks if error message contains a specific string (case-insensitive)
 * 
 * @param {any} error - Error object, string, or API response
 * @param {string} searchString - String to search for
 * @returns {boolean} True if error message contains the search string
 * 
 * @example
 * if (errorContains(error, 'ACCESS RESTRICTED')) {
 *   // Handle restricted access
 * }
 */
export function errorContains(error, searchString) {
  if (!error || !searchString) {
    return false;
  }
  
  const errorMessage = getErrorMessage(error);
  return errorMessage.toLowerCase().includes(searchString.toLowerCase());
}

/**
 * Checks if error is a network error
 * 
 * @param {any} error - Error object
 * @returns {boolean} True if error is a network error
 */
export function isNetworkError(error) {
  if (!error) {
    return false;
  }

  const errorMessage = getErrorMessage(error).toLowerCase();
  
  return (
    errorMessage.includes('network error') ||
    errorMessage.includes('networkerror') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    (!error.response && error.message?.includes('Network Error'))
  );
}

/**
 * Checks if error is a timeout error
 * 
 * @param {any} error - Error object
 * @returns {boolean} True if error is a timeout
 */
export function isTimeoutError(error) {
  if (!error) {
    return false;
  }

  const errorMessage = getErrorMessage(error).toLowerCase();
  
  return (
    errorMessage.includes('timeout') ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT'
  );
}

/**
 * Gets HTTP status code from error if available
 * 
 * @param {any} error - Error object
 * @returns {number|null} HTTP status code or null
 */
export function getErrorStatus(error) {
  if (!error) {
    return null;
  }

  if (error.response?.status) {
    return error.response.status;
  }

  if (error.status) {
    return error.status;
  }

  return null;
}

/**
 * Checks if error is a specific HTTP status code
 * 
 * @param {any} error - Error object
 * @param {number} statusCode - HTTP status code to check
 * @returns {boolean} True if error has the specified status code
 */
export function isErrorStatus(error, statusCode) {
  const status = getErrorStatus(error);
  return status === statusCode;
}

/**
 * Formats error for display with additional context
 * 
 * @param {any} error - Error object
 * @param {Object} options - Formatting options
 * @param {string} options.prefix - Prefix to add to error message
 * @param {string} options.suffix - Suffix to add to error message
 * @param {boolean} options.includeStatus - Include HTTP status code if available
 * @returns {string} Formatted error message
 */
export function formatError(error, options = {}) {
  const {
    prefix = '',
    suffix = '',
    includeStatus = false
  } = options;

  let message = getErrorMessage(error);

  if (includeStatus) {
    const status = getErrorStatus(error);
    if (status) {
      message = `[${status}] ${message}`;
    }
  }

  if (prefix) {
    message = `${prefix} ${message}`;
  }

  if (suffix) {
    message = `${message} ${suffix}`;
  }

  return message;
}
