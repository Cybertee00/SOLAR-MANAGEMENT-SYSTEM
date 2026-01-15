# SPHAiRPlatform Update Mechanism Guide

## Overview

SPHAiRPlatform uses a **secure, authenticated update service** - **NOT a traditional backdoor**. This guide explains how the update mechanism works, how to secure it, and how to use it safely.

## Key Principles

### ✅ What We Have: Secure Update Service

1. **Authentication Required**: All updates require a service token (`PLATFORM_SERVICE_TOKEN`)
2. **Audit Trail**: All update operations are logged to `platform_updates` table
3. **IP Whitelisting**: Optional restriction to specific IP addresses
4. **Version Control**: All deployments are versioned and can be rolled back
5. **No User Accounts**: Uses dedicated service accounts (tokens), not user credentials

### ❌ What We Don't Have: Backdoors

- No hidden access methods
- No bypass authentication
- No undocumented endpoints
- No permanent backdoors

## Security Model

### Authentication Flow

```
┌─────────────────┐
│  Update Request │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  1. Service Token Check │
│     - X-Platform-       │
│       Service-Token     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  2. IP Whitelist Check  │
│     (Optional)          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  3. Authorization       │
│     - Log request       │
│     - Verify version    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  4. Execute Update      │
│     - Backup            │
│     - Apply             │
│     - Verify            │
└─────────────────────────┘
```

### Service Token Security

The `PLATFORM_SERVICE_TOKEN` is your **secure key** for remote updates. Treat it like a master password:

**Best Practices:**
- Generate a strong random token: `openssl rand -base64 32`
- Store in secure password manager
- Never commit to version control
- Use different tokens per environment
- Rotate regularly (quarterly recommended)
- Limit IP access (whitelist only your administrative IPs)

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Required: Service token for update authentication
PLATFORM_SERVICE_TOKEN=your_secure_random_token_here

# Optional: IP whitelist (comma-separated)
PLATFORM_UPDATE_IPS=192.168.1.100,203.0.113.50

# Optional: Update server URL (for future centralized updates)
PLATFORM_UPDATE_SERVER_URL=https://updates.sphairplatform.com

# Optional: Public key for signed updates (future feature)
PLATFORM_UPDATE_PUBLIC_KEY=your_public_key_here
```

### Generate Secure Token

```bash
# Generate a strong random token
openssl rand -base64 32

# Output example:
# 8k3j9s2m4n7p1q5r6t8u0v2w4x6y8z0a1b3c5d7e9f1g3h5
```

## Update Endpoints

### 1. Check for Updates

**Public endpoint** (no authentication required):

```bash
GET /api/platform/updates/check
```

**Response:**
```json
{
  "updateAvailable": false,
  "currentVersion": "1.0.0",
  "latestVersion": "1.0.0"
}
```

### 2. Apply Update

**Requires authentication:**

```bash
POST /api/platform/updates/apply
Headers:
  X-Platform-Service-Token: your_service_token
  Content-Type: application/json
Body:
{
  "version": "1.1.0",
  "updateType": "minor"  // patch, minor, major
}
```

**Response:**
```json
{
  "success": true,
  "updateId": "update-1704067200000",
  "version": "1.1.0",
  "message": "Update applied successfully",
  "logFile": "/app/logs/update-1704067200000.log"
}
```

### 3. Check Update Status

**Requires authentication:**

```bash
GET /api/platform/updates/status/:updateId
Headers:
  X-Platform-Service-Token: your_service_token
```

**Response:**
```json
{
  "id": "update-1704067200000",
  "version": "1.1.0",
  "status": "completed",
  "initiatedBy": "192.168.1.100",
  "initiatedAt": "2024-01-01T12:00:00Z",
  "completedAt": "2024-01-01T12:05:00Z",
  "log": "Update log content..."
}
```

### 4. View Update History

**Requires authentication:**

```bash
GET /api/platform/updates/history?limit=50
Headers:
  X-Platform-Service-Token: your_service_token
```

**Response:**
```json
{
  "updates": [
    {
      "id": "update-1704067200000",
      "version": "1.1.0",
      "status": "completed",
      "initiatedBy": "192.168.1.100",
      "initiatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "count": 1
}
```

### 5. Rollback Update

**Requires authentication:**

```bash
POST /api/platform/updates/rollback
Headers:
  X-Platform-Service-Token: your_service_token
```

**Response:**
```json
{
  "success": true,
  "rollbackId": "rollback-1704067300000",
  "version": "1.0.0",
  "message": "Rollback completed successfully"
}
```

### 6. Health Check

**Public endpoint** (no authentication required):

```bash
GET /api/platform/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.1.0",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Usage Examples

### Update from Command Line

```bash
# Set your service token
export PLATFORM_SERVICE_TOKEN="your_service_token_here"

# Apply update
curl -X POST http://your-server:3001/api/platform/updates/apply \
  -H "X-Platform-Service-Token: ${PLATFORM_SERVICE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "updateType": "minor"
  }'
```

### Update Script

Use the provided deployment script:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh production 1.1.0 your_service_token
```

### Monitor Update Progress

```bash
UPDATE_ID="update-1704067200000"
SERVICE_TOKEN="your_service_token_here"

while true; do
  STATUS=$(curl -s -X GET \
    "http://your-server:3001/api/platform/updates/status/${UPDATE_ID}" \
    -H "X-Platform-Service-Token: ${SERVICE_TOKEN}" | \
    jq -r '.status')
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" == "completed" ] || [ "$STATUS" == "failed" ]; then
    break
  fi
  
  sleep 5
done
```

## Security Best Practices

### 1. Token Management

✅ **DO:**
- Generate strong random tokens
- Store in password manager
- Use different tokens per environment
- Rotate tokens regularly
- Limit IP access

❌ **DON'T:**
- Commit tokens to version control
- Share tokens via email/chat
- Use weak tokens
- Reuse tokens across environments

### 2. Network Security

✅ **DO:**
- Use HTTPS for all update requests
- Whitelist administrative IPs only
- Use VPN for administrative access
- Monitor update logs

❌ **DON'T:**
- Expose update endpoints to public internet
- Allow updates from any IP
- Use HTTP for update requests

### 3. Access Control

✅ **DO:**
- Use separate service tokens per client
- Rotate tokens after employee departure
- Limit token permissions
- Monitor update activity

❌ **DON'T:**
- Share tokens between clients
- Use user accounts for updates
- Grant unnecessary permissions

## Audit Trail

All update operations are logged to the `platform_updates` table:

```sql
SELECT 
  id,
  version,
  update_type,
  status,
  initiated_by,
  initiated_at,
  completed_at,
  error_message
FROM platform_updates
ORDER BY initiated_at DESC
LIMIT 50;
```

## Troubleshooting

### Update Fails with "Unauthorized"

**Cause**: Invalid or missing service token

**Solution**:
1. Verify `PLATFORM_SERVICE_TOKEN` in `.env` file
2. Check token is correct in request header
3. Ensure token matches server configuration

### Update Fails with "Forbidden: IP not authorized"

**Cause**: Request IP not in whitelist

**Solution**:
1. Add your IP to `PLATFORM_UPDATE_IPS` in `.env`
2. Restart application after updating `.env`
3. Verify your public IP address

### Update Completes but Application Unhealthy

**Cause**: Update may have introduced issues

**Solution**:
1. Check application logs: `docker-compose logs app`
2. Check update logs: `tail -f server/logs/update-*.log`
3. Verify database migrations completed
4. Rollback if necessary: `POST /api/platform/updates/rollback`

### Cannot Connect to Update Endpoint

**Cause**: Network or firewall issue

**Solution**:
1. Verify server is running: `GET /api/platform/health`
2. Check firewall rules
3. Verify network connectivity
4. Check DNS resolution

## Multi-Client Deployment

For subscription-based deployments, each client should have:

### Option 1: Shared Infrastructure

- Same `PLATFORM_SERVICE_TOKEN` (if managing centrally)
- Different databases per client
- Centralized update management

### Option 2: Dedicated Infrastructure

- Different `PLATFORM_SERVICE_TOKEN` per client
- Separate deployment per client
- Client-specific update management

## Future Enhancements

### Signed Updates (Coming Soon)

- Cryptographically sign all updates
- Verify signatures before applying
- Prevent unauthorized updates

### Centralized Update Server

- Host updates on dedicated server
- Automatic update checking
- Version management

### Webhook Notifications

- Notify on update completion
- Alert on update failures
- Integrate with monitoring systems

## Summary

**SPHAiRPlatform's update mechanism is:**
- ✅ Secure (requires authentication)
- ✅ Auditable (all operations logged)
- ✅ Reversible (rollback capability)
- ✅ Professional (no backdoors)

**It is NOT:**
- ❌ A backdoor
- ❌ An open endpoint
- ❌ A security risk (when properly configured)

**Remember**: The `PLATFORM_SERVICE_TOKEN` is your key. Keep it secure, rotate it regularly, and limit access to trusted IPs only.
