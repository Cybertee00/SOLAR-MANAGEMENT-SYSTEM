/**
 * Input Validation & Sanitization Middleware
 * 
 * Implements OWASP-recommended input validation:
 * - Schema-based validation using express-validator
 * - Type checking and length limits
 * - Reject unexpected fields
 * - SQL injection prevention via parameterized queries (already in place)
 * - XSS prevention via sanitization
 * 
 * @see https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/README
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation error handler middleware
 * Returns 400 with detailed error messages
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors for client
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input data. Please check the errors below.',
        details: formattedErrors
      });
    }
    // If headers already sent, just call next (shouldn't happen, but safety check)
    return next();
  }
  next();
}

/**
 * Sanitize string inputs to prevent XSS
 * Removes HTML tags and escapes special characters
 */
const sanitizeString = (field) => {
  return body(field)
    .optional()
    .trim()
    .escape() // Escape HTML entities
    .customSanitizer(value => {
      if (typeof value !== 'string') return value;
      // Remove any remaining HTML tags
      return value.replace(/<[^>]*>/g, '');
    });
};

/**
 * Validate UUID format
 */
const validateUUID = (field, location = 'param') => {
  const validator = location === 'param' ? param : body;
  return validator(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`);
};

/**
 * Validate email format
 */
const validateEmail = (field) => {
  return body(field)
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters');
};

/**
 * Validate username
 */
const validateUsername = () => {
  return body('username')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Username must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .escape();
};

/**
 * Validate password strength
 */
const validatePassword = (fieldName = 'password', minLength = 6) => {
  return body(fieldName)
    .isLength({ min: minLength, max: 128 })
    .withMessage(`Password must be between ${minLength} and 128 characters`)
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number');
};

/**
 * Validate role
 */
const validateRole = () => {
  return body('role')
    .optional()
    .isIn(['admin', 'super_admin', 'supervisor', 'technician'])
    .withMessage('Role must be one of: admin, super_admin, supervisor, technician');
};

/**
 * Validate task type
 */
const validateTaskType = () => {
  return body('task_type')
    .optional()
    .isIn(['PM', 'PCM', 'UCM'])
    .withMessage('Task type must be one of: PM, PCM, UCM');
};

/**
 * Validate date format (YYYY-MM-DD)
 */
const validateDate = (field) => {
  return body(field)
    .optional()
    .isISO8601()
    .withMessage(`${field} must be a valid date in ISO 8601 format (YYYY-MM-DD)`)
    .toDate();
};

/**
 * Validate datetime format (ISO 8601)
 */
const validateDateTime = (field) => {
  return body(field)
    .optional()
    .isISO8601()
    .withMessage(`${field} must be a valid datetime in ISO 8601 format`)
    .toDate();
};

/**
 * Validate positive integer
 */
const validatePositiveInteger = (field) => {
  return body(field)
    .optional()
    .isInt({ min: 0 })
    .withMessage(`${field} must be a non-negative integer`)
    .toInt();
};

/**
 * Validate string with max length
 */
const validateString = (field, maxLength = 255, required = false) => {
  const validator = required 
    ? body(field).trim().notEmpty().withMessage(`${field} is required`)
    : body(field).optional().trim();
  
  return validator
    .isLength({ max: maxLength })
    .withMessage(`${field} must be less than ${maxLength} characters`)
    .escape();
};

/**
 * Validate JSONB data (for checklist responses)
 */
const validateJSONB = (field) => {
  return body(field)
    .custom((value) => {
      if (value === undefined || value === null) return true; // Optional
      try {
        // If it's already an object, it's valid
        if (typeof value === 'object') return true;
        // If it's a string, try to parse it
        if (typeof value === 'string') {
          JSON.parse(value);
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    })
    .withMessage(`${field} must be valid JSON`);
};

/**
 * Remove unexpected fields from request body
 * Only allows fields specified in allowedFields array
 */
function removeUnexpectedFields(allowedFields) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const bodyKeys = Object.keys(req.body);
      const unexpectedFields = bodyKeys.filter(key => !allowedFields.includes(key));
      
      if (unexpectedFields.length > 0) {
        // Remove unexpected fields
        unexpectedFields.forEach(field => {
          delete req.body[field];
        });
        // Log warning in development
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Removed unexpected fields from request: ${unexpectedFields.join(', ')}`);
        }
      }
    }
    next();
  };
}

// Validation schemas for common endpoints

/**
 * User creation validation schema
 */
const validateCreateUser = [
  removeUnexpectedFields(['username', 'email', 'full_name', 'role', 'roles', 'password']),
  validateUsername(),
  validateEmail('email'),
  validateString('full_name', 255, true),
  validateRole(),
  body('roles')
    .optional()
    .isArray()
    .withMessage('roles must be an array')
    .custom((roles) => {
      if (roles && roles.length > 0) {
        const validRoles = ['technician', 'supervisor', 'admin', 'super_admin'];
        const invalidRoles = roles.filter(r => !validRoles.includes(r));
        if (invalidRoles.length > 0) {
          throw new Error(`Invalid roles: ${invalidRoles.join(', ')}. Valid roles: ${validRoles.join(', ')}`);
        }
      }
      return true;
    }),
  body('password')
    .optional()
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
  handleValidationErrors
];

/**
 * User update validation schema
 */
const validateUpdateUser = [
  removeUnexpectedFields(['email', 'full_name', 'role', 'roles', 'password', 'is_active']),
  validateUUID('id', 'param'),
  validateEmail('email').optional(),
  validateString('full_name', 255).optional(),
  validateRole(),
  body('roles')
    .optional()
    .isArray()
    .withMessage('roles must be an array')
    .custom((roles) => {
      if (roles && roles.length > 0) {
        const validRoles = ['technician', 'supervisor', 'admin', 'super_admin'];
        const invalidRoles = roles.filter(r => !validRoles.includes(r));
        if (invalidRoles.length > 0) {
          throw new Error(`Invalid roles: ${invalidRoles.join(', ')}. Valid roles: ${validRoles.join(', ')}`);
        }
      }
      return true;
    }),
  body('password')
    .optional()
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

/**
 * Login validation schema
 */
const validateLogin = [
  removeUnexpectedFields(['username', 'password']),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required')
    .isLength({ max: 255 })
    .withMessage('Username must be less than 255 characters')
    .escape(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password must be between 1 and 128 characters'),
  handleValidationErrors
];

/**
 * Task creation validation schema
 */
const validateCreateTask = [
  removeUnexpectedFields(['checklist_template_id', 'asset_id', 'assigned_to', 'task_type', 'scheduled_date']),
  validateUUID('checklist_template_id', 'body'),
  validateUUID('asset_id', 'body'),
  validateUUID('assigned_to', 'body').optional(),
  validateTaskType(),
  validateDate('scheduled_date').optional(),
  handleValidationErrors
];

/**
 * Change password validation schema
 */
const validateChangePassword = [
  removeUnexpectedFields(['currentPassword', 'newPassword']),
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Current password must be between 1 and 128 characters'),
  validatePassword('newPassword', 6),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  sanitizeString,
  validateUUID,
  validateEmail,
  validateUsername,
  validatePassword,
  validateRole,
  validateTaskType,
  validateDate,
  validateDateTime,
  validatePositiveInteger,
  validateString,
  validateJSONB,
  removeUnexpectedFields,
  // Pre-built schemas
  validateCreateUser,
  validateUpdateUser,
  validateLogin,
  validateCreateTask,
  validateChangePassword
};
