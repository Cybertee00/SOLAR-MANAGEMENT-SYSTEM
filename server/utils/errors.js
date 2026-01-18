/**
 * Error Handling Utilities
 * 
 * Provides standardized error classes and error response formatting
 */

const logger = require('./logger');
const { isProduction } = require('./env');

/**
 * Base Application Error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Mark as operational error (expected)
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error (400)
 */
class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * Authentication Error (401)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error (403)
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

/**
 * Rate Limit Error (429)
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

/**
 * Format error response for client
 * @param {Error} error - Error object
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(error) {
  // Operational errors (known/expected)
  if (error.isOperational) {
    return {
      error: true,
      code: error.code || 'APPLICATION_ERROR',
      message: error.message || 'An error occurred',
      ...(error.details && { details: error.details }),
      // Only include stack trace in development
      ...(!isProduction() && error.stack && { stack: error.stack })
    };
  }

  // Programming errors (unexpected)
  // Don't expose internal errors to client
  return {
    error: true,
    code: 'INTERNAL_ERROR',
    message: isProduction() 
      ? 'An internal error occurred. Please contact support if this persists.'
      : error.message || 'An internal error occurred',
    // Only include stack trace in development
    ...(!isProduction() && error.stack && { stack: error.stack })
  };
}

/**
 * Global error handler middleware
 * Must be used as the last middleware in Express
 */
function globalErrorHandler(err, req, res, next) {
  // Log error
  const logData = {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.session?.userId || 'anonymous',
    error: err.message,
    code: err.code || 'UNKNOWN',
    statusCode: err.statusCode || 500
  };

  // Log at appropriate level
  if (err.statusCode >= 500) {
    logger.error('Unhandled error', { ...logData, stack: err.stack });
  } else if (err.statusCode >= 400) {
    logger.warn('Client error', logData);
  } else {
    logger.debug('Application error', logData);
  }

  // Format error response
  const errorResponse = formatErrorResponse(err);
  const statusCode = err.statusCode || 500;

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors and pass to error handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle 404 errors (route not found)
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError('Route');
  next(error);
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  formatErrorResponse,
  globalErrorHandler,
  asyncHandler,
  notFoundHandler
};
