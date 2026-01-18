/**
 * Error Classes Tests
 * Tests for custom error classes and error handling utilities
 */

const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  formatErrorResponse,
  asyncHandler
} = require('../../utils/errors');

describe('Error Classes', () => {
  describe('AppError', () => {
    test('should create error with default status code', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    test('should create error with custom status code', () => {
      const error = new AppError('Test error', 400, 'CUSTOM_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_ERROR');
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('AuthenticationError', () => {
    test('should create authentication error with 401 status', () => {
      const error = new AuthenticationError('Not authenticated');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('AuthorizationError', () => {
    test('should create authorization error with 403 status', () => {
      const error = new AuthorizationError('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    test('should create not found error with 404 status', () => {
      const error = new NotFoundError('User');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    test('should create conflict error with 409 status', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
    });
  });

  describe('RateLimitError', () => {
    test('should create rate limit error with 429 status', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
    });
  });
});

describe('formatErrorResponse', () => {
  test('should format operational error correctly', () => {
    const error = new ValidationError('Invalid input');
    const response = formatErrorResponse(error);
    expect(response.error).toBe(true);
    expect(response.code).toBe('VALIDATION_ERROR');
    expect(response.message).toBe('Invalid input');
  });

  test('should hide stack trace in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const error = new Error('Internal error');
    error.isOperational = false;
    const response = formatErrorResponse(error);
    expect(response.stack).toBeUndefined();
    process.env.NODE_ENV = originalEnv; // Reset
  });
});

describe('asyncHandler', () => {
  test('should catch async errors and pass to next', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    
    const asyncFn = async () => {
      throw new Error('Test error');
    };
    
    const handler = asyncHandler(asyncFn);
    await handler(req, res, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('should pass through successful async functions', async () => {
    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();
    
    const asyncFn = async (req, res) => {
      res.json({ success: true });
    };
    
    const handler = asyncHandler(asyncFn);
    await handler(req, res, next);
    
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });
});
