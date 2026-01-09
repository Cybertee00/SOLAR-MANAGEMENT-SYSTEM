# Security Hardening Guide

This document outlines the security measures implemented in the O&M Management System following OWASP best practices.

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [Input Validation & Sanitization](#input-validation--sanitization)
3. [API Key Security](#api-key-security)
4. [Session Security](#session-security)
5. [Security Headers](#security-headers)
6. [Environment Variables](#environment-variables)
7. [Production Deployment Checklist](#production-deployment-checklist)

## Rate Limiting

### Implementation

Rate limiting is implemented using `express-rate-limit` and `express-slow-down` with three tiers:

1. **Standard Limiter** (General API endpoints)
   - Default: 100 requests per 15 minutes per IP/user
   - Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`
   - Uses user ID for authenticated requests, IP for anonymous

2. **Auth Limiter** (Login endpoints)
   - Default: 5 attempts per 15 minutes per IP
   - Prevents brute force attacks
   - Configurable via `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX`
   - Only counts failed login attempts

3. **Sensitive Operation Limiter** (User creation, password changes)
   - Default: 10 requests per hour per user
   - Configurable via `SENSITIVE_RATE_LIMIT_WINDOW_MS` and `SENSITIVE_RATE_LIMIT_MAX`

4. **Speed Limiter** (All endpoints)
   - Adds progressive delay after many requests
   - Default: 100ms delay after 50 requests in 1 minute
   - Prevents rapid-fire attacks while allowing legitimate use

### Configuration

All rate limits can be configured via environment variables (see `.env.example`).

### Response Format

When rate limit is exceeded, the API returns:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900
}
```

Status code: `429 Too Many Requests`

## Input Validation & Sanitization

### Implementation

Input validation is implemented using `express-validator` with schema-based validation:

- **Type checking**: All inputs are validated for correct data types
- **Length limits**: String inputs have maximum length constraints
- **Format validation**: UUIDs, emails, dates are validated for correct format
- **Unexpected field rejection**: Only allowed fields are accepted, others are silently removed
- **XSS prevention**: All string inputs are escaped and HTML tags are removed
- **SQL injection prevention**: All database queries use parameterized queries (already in place)

### Validation Schemas

Pre-built validation schemas are available for:

- `validateCreateUser`: User creation
- `validateUpdateUser`: User updates
- `validateLogin`: Authentication
- `validateCreateTask`: Task creation
- `validateChangePassword`: Password changes

### Custom Validation

For custom validation, use the provided validators:

```javascript
const { validateUUID, validateEmail, validateString, handleValidationErrors } = require('../middleware/inputValidation');

router.post('/endpoint', [
  validateUUID('id', 'param'),
  validateEmail('email'),
  validateString('name', 255, true), // max 255 chars, required
  handleValidationErrors
], async (req, res) => {
  // Handler
});
```

### Error Response Format

Validation errors return:

```json
{
  "error": "Validation failed",
  "message": "Invalid input data. Please check the errors below.",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid-email"
    }
  ]
}
```

Status code: `400 Bad Request`

## API Key Security

### Implementation

API keys are handled securely following OWASP best practices:

1. **Key Generation**: Keys are generated server-side using cryptographically secure random values
2. **Storage**: Only bcrypt hashes are stored in the database, never plaintext secrets
3. **Format**: Keys use format `tok_<uuid>_<secret>` where only the hash is stored
4. **Rotation**: Keys can be deactivated and new ones created (rotation recommended every 90 days)
5. **Client-side**: No API keys are exposed in client-side code

### Key Management

- Keys are created via admin-only endpoint: `POST /api/api-tokens`
- Keys are returned **only once** on creation - store securely
- Keys can be deactivated: `DELETE /api/api-tokens/:id`
- Last used timestamp is tracked for monitoring

### Best Practices

1. **Never commit keys to version control**
2. **Rotate keys regularly** (recommended: every 90 days)
3. **Use different keys for different environments** (dev, staging, prod)
4. **Monitor key usage** via `last_used` timestamp
5. **Deactivate unused keys** immediately

## Session Security

### Configuration

Sessions are configured with secure defaults:

- **HttpOnly cookies**: Prevents XSS attacks
- **SameSite: strict**: CSRF protection
- **Secure flag**: Enabled in production with HTTPS
- **Session secret**: Must be set via `SESSION_SECRET` environment variable
- **Session name**: Changed from default `connect.sid` to `sessionId`

### Session Secret

**CRITICAL**: The session secret must be a strong, randomly generated string.

Generate a secure secret:

```bash
openssl rand -base64 32
```

Set in `.env`:

```
SESSION_SECRET=your-generated-secret-here
```

### Production Considerations

- Use Redis or similar for session storage in multi-server deployments
- Enable HTTPS and set `HTTPS_ENABLED=true`
- Set `secure: true` in cookie configuration
- Rotate session secret regularly

## Security Headers

Security headers are implemented using Helmet.js:

- **Content Security Policy (CSP)**: Restricts resource loading
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: Legacy XSS protection
- **Strict-Transport-Security (HSTS)**: Enforces HTTPS in production
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

Headers are automatically configured based on environment (development vs production).

## Environment Variables

### Required in Production

These environment variables **MUST** be set in production:

- `SESSION_SECRET`: Strong random string for session encryption
- `DB_PASSWORD`: Database password
- `NODE_ENV`: Set to `production`

### Recommended

- `CORS_ORIGIN`: Specific allowed origins (comma-separated)
- `HTTPS_ENABLED`: Set to `true` when using HTTPS
- `TRUST_PROXY`: Set to `true` if behind reverse proxy

### Optional (with sensible defaults)

- Rate limiting configuration
- Request size limits
- Session max age

See `.env.example` for complete list with descriptions.

## Production Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate and set strong `SESSION_SECRET`
- [ ] Set secure `DB_PASSWORD`
- [ ] Configure `CORS_ORIGIN` with specific allowed origins
- [ ] Enable HTTPS and set `HTTPS_ENABLED=true`
- [ ] Set `TRUST_PROXY=true` if behind reverse proxy/load balancer
- [ ] Review and adjust rate limiting thresholds
- [ ] Set up session store (Redis) for multi-server deployments
- [ ] Enable database connection pooling limits
- [ ] Set up monitoring and alerting for security events
- [ ] Review and rotate all API keys
- [ ] Set up automated backups
- [ ] Configure firewall rules
- [ ] Enable database SSL connections
- [ ] Review and test all input validation
- [ ] Perform security audit/penetration testing

## Security Monitoring

Security events are logged for:

- Failed authentication attempts
- Rate limit violations
- Validation errors
- Suspicious activity patterns

In production, integrate with a security monitoring system (e.g., SIEM, logging service).

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not create a public issue
2. Contact the development team directly
3. Provide detailed information about the vulnerability
4. Allow time for the fix before public disclosure

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Secure Headers](https://owasp.org/www-project-secure-headers/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
