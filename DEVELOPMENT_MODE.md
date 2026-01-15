# Development Mode - License System

## Overview

The license system can be disabled during development to allow unrestricted access while building and testing the application.

## Enabling Development Mode

### Method 1: Environment Variable (Recommended)

Set `NODE_ENV=development` in your server environment:

**Windows (PowerShell):**
```powershell
$env:NODE_ENV="development"
```

**Windows (Command Prompt):**
```cmd
set NODE_ENV=development
```

**Linux/Mac:**
```bash
export NODE_ENV=development
```

**In `.env` file (server directory):**
```env
NODE_ENV=development
```

### Method 2: Disable License Check

Alternatively, set `DISABLE_LICENSE_CHECK=true`:

**In `.env` file:**
```env
DISABLE_LICENSE_CHECK=true
```

## What Happens in Development Mode

### Backend Behavior

- ✅ **License validation is skipped** - All API requests are allowed
- ✅ **No license required** - System operates without a license
- ✅ **License middleware returns success** - No blocking occurs
- ✅ **License status shows "Development Mode"** - Frontend displays dev status

### Frontend Behavior

- ✅ **No expiry warnings** - License status banner is hidden
- ✅ **No error messages** - License errors are suppressed
- ✅ **License Management still available** - Admin can still manage licenses

## Production Mode

When deploying to production:

1. **Remove development mode:**
   ```env
   NODE_ENV=production
   # or remove DISABLE_LICENSE_CHECK
   ```

2. **Activate a license:**
   - Generate license key
   - Activate via License Management interface
   - System will enforce license expiry

## Checking Current Mode

The license status endpoint will return `dev_mode: true` when in development:

```json
{
  "is_valid": true,
  "dev_mode": true,
  "company_name": "Development Mode",
  "days_remaining": 999
}
```

## Important Notes

⚠️ **Security Warning**: Development mode should NEVER be enabled in production!

⚠️ **License Enforcement**: In production, license validation is mandatory and cannot be bypassed.

✅ **Testing**: Development mode is perfect for local development and testing.

## Quick Reference

| Mode | NODE_ENV | License Check | Status |
|------|----------|---------------|--------|
| Development | `development` | Disabled | ✅ Allowed |
| Development | `DISABLE_LICENSE_CHECK=true` | Disabled | ✅ Allowed |
| Production | `production` | Enabled | 🔒 Required |
