const { simplifyErrorMessage } = require('./errorMessages');

/**
 * Formats error response for API endpoints
 * Returns only the error message (no details field)
 * 
 * @param {Error|string|any} error - Error object, string, or any error
 * @param {number} statusCode - HTTP status code (default: 500)
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(error, statusCode = 500) {
  let message = 'Operation failed';
  
  if (typeof error === 'string') {
    message = simplifyErrorMessage(error);
  } else if (error instanceof Error) {
    message = simplifyErrorMessage(error.message);
  } else if (error?.message) {
    message = simplifyErrorMessage(error.message);
  } else if (error?.error) {
    message = simplifyErrorMessage(error.error);
  }
  
  return {
    error: message
  };
}

/**
 * Sends standardized error response
 * 
 * @param {Response} res - Express response object
 * @param {Error|string|any} error - Error to send
 * @param {number} statusCode - HTTP status code (default: 500)
 */
function sendErrorResponse(res, error, statusCode = 500) {
  const response = formatErrorResponse(error, statusCode);
  res.status(statusCode).json(response);
}

module.exports = {
  formatErrorResponse,
  sendErrorResponse
};
