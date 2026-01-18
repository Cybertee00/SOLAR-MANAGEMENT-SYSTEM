# License System Usage Guide

**Version:** 1.0  
**Date:** January 2026  
**System:** SPHAiRPlatform - Signed Token License Architecture

---

## Overview

This guide explains how to use the new **cryptographically signed license token system** for SPHAiRPlatform. The new system provides:

- ✅ **Cryptographic Security** - HMAC-SHA256 signed tokens
- ✅ **Offline Validation** - License data encoded in token
- ✅ **Multi-Tenant Support** - Per-company licenses
- ✅ **License Revocation** - Remote disable capability
- ✅ **License Tiers** - Different pricing/features per tier

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Generating License Tokens](#generating-license-tokens)
3. [Activating Licenses](#activating-licenses)
4. [Validating Licenses](#validating-licenses)
5. [License Tiers and Features](#license-tiers-and-features)
6. [Multi-Tenant Usage](#multi-tenant-usage)
7. [License Revocation](#license-revocation)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### For BRIGHTSTEP (License Generator)

1. **Generate License Token:**
   ```bash
   POST /api/license/generate
   Body: {
     "company_name": "Customer Company Name",
     "tier": "medium",
     "max_users": 20,
     "duration_days": 90
   }
   ```

2. **Provide Token to Customer:**
   - Customer receives `license_token` (signed format)
   - They activate it via `/api/license/activate`

### For Customers (License Activation)

1. **Activate License:**
   ```bash
   POST /api/license/activate
   Body: {
     "license_key": "<token-from-brightstep>",
     "company_name": "Your Company Name",
     "contact_email": "contact@company.com"
   }
   ```

2. **System Validates Automatically:**
   - Token signature verified
   - License data extracted
   - Access granted

---

## Generating License Tokens

### Using API Endpoint (Recommended)

**Endpoint:** `POST /api/license/generate`

**Authentication:** Requires admin authentication

**Request Body:**
```json
{
  "company_name": "Customer Company Name",
  "company_id": "optional-uuid-for-multi-tenant",
  "tier": "small" | "medium" | "large" | "enterprise",
  "max_users": 10,
  "features": ["white_labeling", "api_access"],
  "license_type": "trial" | "subscription" | "perpetual",
  "duration_days": 90
}
```

**Response:**
```json
{
  "license_token": "eyJhbGci...signed-token-here",
  "license_key": "SPHAIR-XXXX-XXXX-XXXX-XXXX",
  "expires_at": "2026-04-01T00:00:00.000Z",
  "duration_days": 90,
  "tier": "medium",
  "max_users": 20,
  "features": ["white_labeling", "api_access"],
  "license_type": "subscription",
  "message": "License token generated. Use /activate endpoint to activate it.",
  "note": "The license_token (signed format) is recommended for production use."
}
```

**Example (cURL):**
```bash
curl -X POST http://localhost:3001/api/license/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=your-session-cookie" \
  -d '{
    "company_name": "Solar Power Solutions",
    "tier": "medium",
    "max_users": 20,
    "duration_days": 90
  }'
```

### Using Node.js Script

**File:** `scripts/generate-license.js`

**Usage:**
```bash
node scripts/generate-license.js "Company Name"
```

**Output:**
```
========================================
SPHAiRPlatform License Key Generator
BRIGHTSTEP TECHNOLOGIES Pty Ltd
========================================

Company Name: Company Name
License Key: SPHAIR-XXXX-XXXX-XXXX-XXXX
Expires: 2026-04-01
Duration: 90 days (3 months)
```

**Note:** This script generates human-readable keys. For production, use the API endpoint which generates signed tokens.

---

## Activating Licenses

### Activate New License

**Endpoint:** `POST /api/license/activate`

**Authentication:** Requires admin authentication

**Request Body (New Token Format):**
```json
{
  "license_key": "eyJhbGci...full-signed-token",
  "company_name": "Customer Company Name",
  "contact_email": "contact@company.com",
  "contact_phone": "+1234567890"
}
```

**Request Body (Legacy Format - Still Supported):**
```json
{
  "license_key": "SPHAIR-XXXX-XXXX-XXXX-XXXX",
  "company_name": "Customer Company Name",
  "contact_email": "contact@company.com"
}
```

**Response:**
```json
{
  "message": "License activated successfully",
  "license": {
    "id": "uuid-here",
    "company_name": "Customer Company Name",
    "tier": "medium",
    "activated_at": "2026-01-01T00:00:00.000Z",
    "expires_at": "2026-04-01T00:00:00.000Z",
    "days_remaining": 90
  },
  "platform_name": "SPHAiRPlatform",
  "platform_tagline": "One Platform. Every Task.",
  "owner": "BRIGHTSTEP TECHNOLOGIES Pty Ltd"
}
```

**Example (cURL):**
```bash
curl -X POST http://localhost:3001/api/license/activate \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=your-session-cookie" \
  -d '{
    "license_key": "eyJhbGci...your-token-here",
    "company_name": "Solar Power Solutions",
    "contact_email": "admin@solarrpower.com"
  }'
```

### What Happens During Activation

1. **Token Verification** (if signed token):
   - Signature verified (HMAC-SHA256)
   - Payload decoded (company name, tier, expiry, etc.)
   - Expiry checked

2. **Database Check**:
   - Check if license already activated
   - Validate license key format

3. **License Storage**:
   - Store signed token in `license_token` field
   - Store hashed key in `license_key` field (for indexing)
   - Set `activated_at` timestamp
   - Calculate `expires_at` from token or default (90 days)

4. **Activation Complete**:
   - License active and validated
   - System access granted

---

## Validating Licenses

### Automatic Validation (Middleware)

The system **automatically validates licenses** on every API request via middleware:

```javascript
// Middleware checks license on protected routes
requireValidLicense(pool)
```

**What It Checks:**
- ✅ License exists and is active
- ✅ License is not revoked
- ✅ License is not expired
- ✅ Token signature valid (if signed token)

**If Invalid:**
- Returns `403 Forbidden`
- Error message explains why (expired, revoked, missing)

### Manual Validation (Status Check)

**Endpoint:** `GET /api/license/status`

**Response:**
```json
{
  "is_valid": true,
  "license_required": false,
  "license_expired": false,
  "expires_at": "2026-04-01T00:00:00.000Z",
  "activated_at": "2026-01-01T00:00:00.000Z",
  "days_remaining": 75,
  "is_expiring_soon": false,
  "company_name": "Customer Company Name",
  "tier": "medium",
  "features": ["white_labeling", "api_access"],
  "platform_name": "SPHAiRPlatform",
  "platform_tagline": "One Platform. Every Task.",
  "owner": "BRIGHTSTEP TECHNOLOGIES Pty Ltd"
}
```

### Verify Token Programmatically

**In Code:**
```javascript
const { verifyLicenseToken, decodeLicenseToken } = require('./utils/license');

// Verify and decode token
const payload = verifyLicenseToken(tokenString);
if (payload) {
  console.log('Valid license:', payload);
  // payload contains: companyId, companyName, tier, maxUsers, features, etc.
} else {
  console.log('Invalid or expired token');
}

// Decode without verification (for display only)
const licenseInfo = decodeLicenseToken(tokenString);
// Shows license info without verifying signature
```

---

## License Tiers and Features

### Available Tiers

| Tier | Max Users | Typical Use Case |
|------|-----------|------------------|
| **small** | 2-10 | Small teams, pilot projects |
| **medium** | 10-30 | Medium-sized operations |
| **large** | 30-100 | Large organizations |
| **enterprise** | 100+ | Enterprise deployments |

### License Types

| Type | Duration | Use Case |
|------|----------|----------|
| **trial** | 14-30 days | Evaluation, testing |
| **subscription** | 90 days (renewable) | Production deployments |
| **perpetual** | No expiry | One-time purchase |

### Features (Feature Flags)

**Available Features:**
- `white_labeling` - Custom branding
- `api_access` - API access
- `custom_reports` - Custom reporting
- `priority_support` - Priority support
- `advanced_analytics` - Advanced analytics

**Example License with Features:**
```json
{
  "tier": "large",
  "features": ["white_labeling", "api_access", "custom_reports"],
  "max_users": 50
}
```

### Generating License with Tier and Features

```bash
POST /api/license/generate
{
  "company_name": "Enterprise Customer",
  "tier": "enterprise",
  "max_users": 100,
  "features": ["white_labeling", "api_access", "custom_reports", "advanced_analytics"],
  "license_type": "subscription",
  "duration_days": 90
}
```

---

## Multi-Tenant Usage

### Activating License for Specific Company

When using multi-tenant architecture, associate license with company:

**Request:**
```json
{
  "license_key": "eyJhbGci...token",
  "company_id": "uuid-of-company",
  "company_name": "Company Name",
  "contact_email": "contact@company.com"
}
```

**What Happens:**
- License associated with `company_id`
- Only that company can use this license
- Other companies can't access this license

### Company-Specific License Validation

The middleware automatically checks:
- Company has active license (`company_id` match)
- License not revoked
- License not expired

**Validation Logic:**
```javascript
// Middleware checks company_id from session
const companyId = req.session?.company_id;
// Only validates license for that company
```

---

## License Revocation

### Revoke a License

**Endpoint:** `POST /api/license/revoke`

**Authentication:** Requires admin authentication (BRIGHTSTEP only)

**Request Body:**
```json
{
  "license_id": "uuid-of-license",
  "reason": "Contract terminated" // Optional
}
```

**Response:**
```json
{
  "message": "License revoked successfully",
  "license": {
    "id": "uuid-here",
    "company_name": "Company Name",
    "revoked_at": "2026-01-15T12:00:00.000Z",
    "revoked_reason": "Contract terminated"
  }
}
```

**Example (cURL):**
```bash
curl -X POST http://localhost:3001/api/license/revoke \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=your-session-cookie" \
  -d '{
    "license_id": "uuid-of-license-to-revoke",
    "reason": "Contract terminated by customer"
  }'
```

### What Happens When Revoked

1. **Immediate Effect:**
   - `is_revoked` set to `true`
   - `revoked_at` timestamp set
   - `revoked_reason` stored
   - `is_active` set to `false`

2. **Next Request:**
   - License validation fails
   - Returns `403 License Revoked` error
   - System access blocked

3. **Re-activation:**
   - Revoked licenses cannot be re-activated
   - New license required

---

## API Reference

### Generate License Token

**POST** `/api/license/generate`

**Auth:** Admin required

**Request:**
```json
{
  "company_name": string (required),
  "company_id": UUID (optional),
  "tier": "small" | "medium" | "large" | "enterprise" (optional, default: "small"),
  "max_users": number (optional, default: 10),
  "features": string[] (optional, default: []),
  "license_type": "trial" | "subscription" | "perpetual" (optional, default: "subscription"),
  "duration_days": number (optional, default: 90)
}
```

**Response:** `200 OK`
```json
{
  "license_token": string,
  "license_key": string,
  "expires_at": ISO timestamp,
  "duration_days": number,
  "tier": string,
  "max_users": number,
  "features": string[],
  "license_type": string
}
```

---

### Activate License

**POST** `/api/license/activate`

**Auth:** Admin required

**Request:**
```json
{
  "license_key": string (required), // Signed token or legacy key
  "company_name": string (required),
  "company_id": UUID (optional),
  "contact_email": string (optional),
  "contact_phone": string (optional)
}
```

**Response:** `201 Created`
```json
{
  "message": "License activated successfully",
  "license": {
    "id": UUID,
    "company_name": string,
    "tier": string,
    "activated_at": ISO timestamp,
    "expires_at": ISO timestamp,
    "days_remaining": number
  }
}
```

---

### Get License Status

**GET** `/api/license/status`

**Auth:** Public endpoint

**Response:** `200 OK`
```json
{
  "is_valid": boolean,
  "license_required": boolean,
  "license_expired": boolean,
  "expires_at": ISO timestamp | null,
  "activated_at": ISO timestamp | null,
  "days_remaining": number,
  "is_expiring_soon": boolean,
  "company_name": string,
  "tier": string,
  "features": string[]
}
```

---

### Get License Info (Admin)

**GET** `/api/license/info`

**Auth:** Admin required

**Response:** `200 OK`
```json
{
  "license_found": true,
  "id": UUID,
  "company_name": string,
  "tier": string,
  "license_type": string,
  "max_users": number,
  "features": string[],
  "is_expired": boolean,
  "days_remaining": number,
  "expires_at": ISO timestamp,
  "activated_at": ISO timestamp
}
```

---

### Renew License

**PUT** `/api/license/renew`

**Auth:** Admin required

**Request:**
```json
{
  "license_key": string (required) // Token or legacy key
}
```

**Response:** `200 OK`
```json
{
  "message": "License renewed successfully",
  "license": {
    "id": UUID,
    "company_name": string,
    "activated_at": ISO timestamp,
    "expires_at": ISO timestamp,
    "days_remaining": number
  }
}
```

---

### Revoke License

**POST** `/api/license/revoke`

**Auth:** Admin required (BRIGHTSTEP only)

**Request:**
```json
{
  "license_id": UUID (required),
  "reason": string (optional)
}
```

**Response:** `200 OK`
```json
{
  "message": "License revoked successfully",
  "license": {
    "id": UUID,
    "company_name": string,
    "revoked_at": ISO timestamp,
    "revoked_reason": string
  }
}
```

---

## Common Use Cases

### Use Case 1: Generate and Activate License for New Customer

**Step 1: Generate License Token (BRIGHTSTEP)**
```bash
POST /api/license/generate
{
  "company_name": "Solar Power Solutions",
  "tier": "medium",
  "max_users": 25,
  "duration_days": 90
}
```

**Response:**
```json
{
  "license_token": "eyJhbGci...token-here",
  "license_key": "SPHAIR-XXXX-XXXX-XXXX-XXXX",
  "expires_at": "2026-04-01T00:00:00.000Z",
  ...
}
```

**Step 2: Provide Token to Customer**
- Send `license_token` to customer securely
- Include activation instructions

**Step 3: Customer Activates (Customer Admin)**
```bash
POST /api/license/activate
{
  "license_key": "eyJhbGci...token-received",
  "company_name": "Solar Power Solutions",
  "contact_email": "admin@solarpower.com"
}
```

**Result:** License activated, system access granted

---

### Use Case 2: Generate Trial License

**Generate 30-day Trial:**
```bash
POST /api/license/generate
{
  "company_name": "Prospective Customer",
  "tier": "small",
  "max_users": 5,
  "license_type": "trial",
  "duration_days": 30,
  "features": []
}
```

**Result:** 30-day trial license with limited users

---

### Use Case 3: Generate Enterprise License with All Features

**Generate Enterprise License:**
```bash
POST /api/license/generate
{
  "company_name": "Large Enterprise",
  "tier": "enterprise",
  "max_users": 200,
  "license_type": "subscription",
  "duration_days": 90,
  "features": [
    "white_labeling",
    "api_access",
    "custom_reports",
    "advanced_analytics",
    "priority_support"
  ]
}
```

**Result:** Enterprise license with all features enabled

---

### Use Case 4: Revoke License (Contract Termination)

**Revoke License:**
```bash
POST /api/license/revoke
{
  "license_id": "uuid-of-license",
  "reason": "Contract terminated - payment default"
}
```

**Result:** License immediately revoked, access blocked on next request

---

## Token Format Details

### Signed Token Structure

```
header.payload.signature

Example:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkxJQ0VOU0UifQ.eyJjb21wYW55X25hbWUiOiJDb21wYW55IE5hbWUiLCJ0aWVyIjoic21hbGwiLCJleHBpcmVzX2F0IjoxNzA0MDk2MDAwfQ.signature-here
```

**Header** (Base64URL encoded JSON):
```json
{
  "alg": "HS256",
  "typ": "LICENSE"
}
```

**Payload** (Base64URL encoded JSON):
```json
{
  "company_id": "uuid-or-null",
  "company_name": "Company Name",
  "tier": "small",
  "max_users": 10,
  "features": [],
  "license_type": "subscription",
  "issued_at": 1704067200000,
  "expires_at": 1704153600000
}
```

**Signature** (HMAC-SHA256):
```
HMAC-SHA256(header.payload, LICENSE_SIGNING_SECRET)
```

---

## Best Practices

### For BRIGHTSTEP (License Generator)

1. **Secure Token Storage**
   - Store `LICENSE_SIGNING_SECRET` securely
   - Never commit to code
   - Use environment variables

2. **Token Generation**
   - Use API endpoint for production
   - Include all required fields
   - Set appropriate tier/features

3. **Token Distribution**
   - Send tokens securely (encrypted email)
   - Include activation instructions
   - Track which token sent to which customer

4. **License Management**
   - Track license activations
   - Monitor expiring licenses
   - Revoke licenses when needed

### For Customers (License Users)

1. **Activation**
   - Activate immediately after receiving token
   - Store activation confirmation
   - Note expiry date

2. **Renewal**
   - Renew before expiry (30 days notice)
   - Contact BRIGHTSTEP for renewal tokens
   - Keep license status monitored

3. **Security**
   - Don't share license tokens
   - Keep tokens confidential
   - Report suspicious activity

---

## Troubleshooting

### Error: "Invalid license token format"

**Cause:** Token format incorrect or corrupted

**Solution:**
- Verify token is complete (no truncation)
- Check token has 3 parts separated by `.`
- Ensure token from correct source

---

### Error: "License token signature verification failed"

**Cause:** Token signature invalid (tampered or wrong secret)

**Solution:**
- Verify `LICENSE_SIGNING_SECRET` matches generator
- Check token not modified
- Regenerate token if needed

---

### Error: "License already activated"

**Cause:** License token already used

**Solution:**
- Check if license already exists in database
- Use different token for new activation
- Or renew existing license instead

---

### Error: "License Expired"

**Cause:** License past expiry date

**Solution:**
- Contact BRIGHTSTEP for renewal
- Activate new license token
- Renew existing license

---

### Error: "License Revoked"

**Cause:** License revoked by BRIGHTSTEP

**Solution:**
- Contact BRIGHTSTEP for reason
- Request new license if appropriate
- Check revocation reason in error message

---

## Environment Configuration

### Required Environment Variables

```bash
# License signing secret (for token generation/verification)
LICENSE_SIGNING_SECRET=<256-bit-random-hex-string>

# Or use SESSION_SECRET as fallback (not recommended)
# LICENSE_SIGNING_SECRET uses SESSION_SECRET if not set
```

### Generate Signing Secret

```bash
# Generate 256-bit random hex string
openssl rand -hex 32
```

### Example .env Configuration

```bash
# License Configuration
LICENSE_SIGNING_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Database (required)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=solar_om_db
DB_USER=postgres
DB_PASSWORD=your_password

# Other configuration...
```

---

## Migration from Legacy Format

### Backward Compatibility

The system supports **both formats** during migration:

1. **Legacy Format** (`SPHAIR-XXXX-XXXX-XXXX-XXXX`)
   - Still supported
   - Database lookup validation
   - No signature verification

2. **New Signed Token Format** (`header.payload.signature`)
   - Recommended for production
   - Cryptographic verification
   - Offline validation

### Migrating Existing Licenses

**Option 1: Keep Legacy Format**
- Existing licenses continue to work
- No migration needed
- Database validation only

**Option 2: Upgrade to Tokens**
- Generate new tokens for renewals
- Activate new tokens alongside old
- Gradually migrate customers

---

## Examples

### Example 1: Generate Small Business License

```bash
curl -X POST http://localhost:3001/api/license/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=your-session" \
  -d '{
    "company_name": "Small Solar Company",
    "tier": "small",
    "max_users": 10,
    "duration_days": 90
  }'
```

### Example 2: Generate Enterprise License

```bash
curl -X POST http://localhost:3001/api/license/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=your-session" \
  -d '{
    "company_name": "Large Enterprise Corp",
    "tier": "enterprise",
    "max_users": 200,
    "features": ["white_labeling", "api_access", "custom_reports"],
    "license_type": "subscription",
    "duration_days": 90
  }'
```

### Example 3: Activate License

```bash
curl -X POST http://localhost:3001/api/license/activate \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=your-session" \
  -d '{
    "license_key": "eyJhbGci...your-token-here",
    "company_name": "My Company",
    "contact_email": "admin@mycompany.com"
  }'
```

### Example 4: Check License Status

```bash
curl http://localhost:3001/api/license/status
```

---

## Support

### For BRIGHTSTEP

- **License Generation:** Use `/api/license/generate`
- **License Revocation:** Use `/api/license/revoke`
- **License Management:** Monitor via database

### For Customers

- **License Activation:** Use `/api/license/activate`
- **Status Check:** Use `/api/license/status`
- **Issues:** Contact BRIGHTSTEP TECHNOLOGIES Pty Ltd

---

## Security Notes

1. **Never Share LICENSE_SIGNING_SECRET**
   - Keep secret secure
   - Don't commit to git
   - Rotate periodically

2. **Protect License Tokens**
   - Send via secure channels
   - Don't log tokens in plain text
   - Revoke compromised tokens

3. **Validate on Server**
   - Always verify on server-side
   - Don't trust client validation
   - Use middleware for automatic validation

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**For:** SPHAiRPlatform License System
