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
export function getErrorMessage(error, defaultMessage = 'An unexpected error occurred') {
  // Handle null/undefined
  if (!error) {
    return defaultMessage;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle Error instances
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }

  // Handle API response errors (Axios format)
  if (error.response) {
    const data = error.response.data;
    
    // Check for error field (most common)
    if (data?.error) {
      if (typeof data.error === 'string') {
        return data.error;
      }
      // If error is an object, try to get message
      if (data.error?.message) {
        return data.error.message;
      }
    }
    
    // Check for message field
    if (data?.message) {
      if (typeof data.message === 'string') {
        return data.message;
      }
    }
    
    // Check for details field (validation errors)
    if (data?.details) {
      if (typeof data.details === 'string') {
        return data.details;
      }
      // If details is an array, join them
      if (Array.isArray(data.details)) {
        return data.details.join(', ');
      }
    }
  }

  // Handle error object with message property
  if (error.message) {
    if (typeof error.message === 'string') {
      return error.message;
    }
  }

  // Handle error object with error property
  if (error.error) {
    if (typeof error.error === 'string') {
      return error.error;
    }
    if (error.error?.message) {
      return error.error.message;
    }
  }

  // Fallback: try to convert to string
  try {
    const stringified = String(error);
    // If it's not just "[object Object]", return it
    if (stringified !== '[object Object]') {
      return stringified;
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
