# Security Implementation: JWT + Redis + bcrypt

This document describes the security implementation following the "ACTUAL SECURITY" pattern with bcrypt + JWT + Redis.

## Architecture Overview

The system implements a two-pronged security approach:

1. **Password Security**: Passwords are hashed using bcrypt before storage
2. **Authentication**: JWT tokens are generated on login and stored in Redis for session management

## Components

### 1. bcrypt Password Hashing

- **Location**: `server/routes/auth.js`, `server/routes/users.js`
- **Implementation**: All passwords are hashed using bcrypt with 10 salt rounds
- **Storage**: Only bcrypt hashes are stored in the database, never plaintext passwords

### 2. JWT Token Generation

- **Location**: `server/utils/jwt.js`
- **Implementation**: 
  - Tokens are generated on successful login
  - Tokens include: userId, username, roles, role (primary), fullName
  - Tokens expire after 24 hours (configurable via `JWT_EXPIRES_IN`)
  - Tokens are signed with `JWT_SECRET` (uses `SESSION_SECRET` if `JWT_SECRET` not set)

### 3. Redis Cache for JWT Storage

- **Location**: `server/utils/redis.js`
- **Implementation**:
  - JWT tokens are stored in Redis with 24-hour TTL
  - Key format: `jwt:{token}`
  - Enables token revocation and validation
  - Falls back gracefully if Redis is unavailable

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-strong-random-secret-here
JWT_EXPIRES_IN=24h

# Redis Configuration (optional - system works without Redis)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

### Enabling Redis

1. Install Redis on your server:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   
   # Windows
   # Download from https://redis.io/download
   ```

2. Start Redis:
   ```bash
   redis-server
   ```

3. Set environment variables:
   ```env
   REDIS_ENABLED=true
   REDIS_URL=redis://localhost:6379
   ```

4. Install Redis client:
   ```bash
   cd server
   npm install redis
   ```

## Authentication Flow

### Login Flow

1. User submits credentials (username/email + password)
2. System finds user in database
3. Password is verified using `bcrypt.compare()`
4. If valid:
   - JWT token is generated
   - Token is stored in Redis (if available)
   - Session is created (for backward compatibility)
   - Token is returned to client in response

### Request Authentication

The `requireAuth` middleware supports two authentication methods:

1. **JWT Token** (preferred):
   - Client sends token in `Authorization: Bearer {token}` header
   - Token is verified and decoded
   - Token is checked in Redis (if available)
   - User context is populated from token

2. **Session-based** (fallback):
   - Uses express-session cookies
   - Maintains backward compatibility

### Logout Flow

1. JWT token is extracted from request
2. Token is deleted from Redis
3. Session is destroyed
4. Session cookie is cleared

## API Usage

### Login

```javascript
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}

Response:
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### Authenticated Requests

```javascript
GET /api/tasks
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Logout

```javascript
POST /api/auth/logout
Authorization: Bearer {token}
```

## Security Benefits

1. **Stateless Authentication**: JWT tokens enable stateless authentication, perfect for load balancing
2. **Token Revocation**: Redis allows immediate token invalidation on logout
3. **Scalability**: Multiple servers can validate tokens via shared Redis instance
4. **Password Security**: bcrypt ensures passwords are never stored in plaintext
5. **Backward Compatibility**: System continues to work with session-based auth if Redis is unavailable

## Load Balancing Support

This implementation supports load balancing:

- **Multiple Auth Services**: Each service instance can validate JWT tokens independently
- **Shared Redis**: All services share the same Redis instance for token validation
- **Stateless**: No need for sticky sessions

For production deployment with load balancing:

1. Set up Redis cluster for high availability
2. Configure load balancer to distribute requests
3. Ensure all service instances use the same `JWT_SECRET`
4. Configure Redis replication for redundancy

## Notes

- The system gracefully degrades if Redis is unavailable (uses memory store)
- Session-based authentication is maintained for backward compatibility
- JWT tokens are validated on every request when provided
- Redis TTL matches JWT expiration time for automatic cleanup
