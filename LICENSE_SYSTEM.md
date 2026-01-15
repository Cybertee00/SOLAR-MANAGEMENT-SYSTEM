# SPHAiRPlatform License System Documentation

## Overview

SPHAiRPlatform implements a time-limited license system that expires after 3 months from activation. This ensures proper licensing control and protects the intellectual property of BRIGHTSTEP TECHNOLOGIES Pty Ltd.

**Platform Name:** SPHAiRPlatform  
**Tagline:** "One Platform. Every Task."  
**Owner:** BRIGHTSTEP TECHNOLOGIES Pty Ltd  
**License Duration:** 3 months (90 days) from activation  
**License Type:** Time-limited subscription

## Intellectual Property Notice

SPHAIR Platform and the associated tagline "One Platform. Every Task." are proprietary intellectual property of BRIGHTSTEP TECHNOLOGIES Pty Ltd. SPHAIR Platform is a centralized digital maintenance and operations application designed for solar power plant operations, providing a unified system for preventive and corrective maintenance, task tracking, asset management, inventory monitoring, dynamic checklists, and automated reporting. The platform replaces paper-based workflows with a fully digital, backend-validated, auditable system, ensuring accountability, operational efficiency, and professional-quality task management. All associated software, source code, logos, design elements, visual assets, and documentation related to SPHAIR Platform are owned exclusively by BRIGHTSTEP TECHNOLOGIES Pty Ltd. Unauthorized copying, reproduction, or distribution of SPHAIR Platform or its components is strictly prohibited.

## License Information

**Platform Name:** SPHAiRPlatform  
**Tagline:** "One Platform. Every Task."  
**Owner:** BRIGHTSTEP TECHNOLOGIES Pty Ltd  
**License Duration:** 3 months from activation  
**License Type:** Time-limited subscription

## System Architecture

### Components

1. **License Database Table** - Stores license information
2. **License Validation Middleware** - Checks license validity on each request
3. **License Management API** - Endpoints for license activation and management
4. **Frontend License Checker** - Displays license status and warnings
5. **License Expiry Handler** - Manages system behavior when license expires

### Database Schema

```sql
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    max_users INTEGER DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### License Validation Flow

1. **System Startup**: Check if valid license exists
2. **API Requests**: Middleware validates license on protected routes
3. **Frontend**: Periodic checks and warnings before expiry
4. **Expiry**: System restricts access when license expires

## Implementation Details

### Backend Components

1. **License Middleware** (`server/middleware/license.js`)
   - Validates license on each API request
   - Returns 403 if license expired
   - Logs license check attempts

2. **License Routes** (`server/routes/license.js`)
   - `POST /api/license/activate` - Activate new license
   - `GET /api/license/status` - Get current license status
   - `GET /api/license/info` - Get license information
   - `PUT /api/license/renew` - Renew expired license

3. **License Utilities** (`server/utils/license.js`)
   - Generate license keys
   - Validate license expiry
   - Calculate expiry dates

### Frontend Components

1. **License Status Component** - Shows license expiry warnings
2. **License Activation Modal** - For initial license setup
3. **License Expiry Banner** - Warning banner before expiry

## License Key Format

License keys are generated using:
- Company identifier
- Timestamp
- Cryptographic hash
- Format: `SPHAIR-XXXX-XXXX-XXXX-XXXX`

## Security Considerations

1. **License keys are hashed** before storage
2. **Server-side validation** only (no client-side bypass)
3. **Automatic expiry** enforcement
4. **Audit logging** of license checks
5. **Grace period** (optional) for renewal

## Activation Process

1. Admin provides company information
2. System generates license key
3. License activated with 3-month expiry
4. Expiry date calculated: `activated_at + 90 days`
5. License stored in database

## Expiry Handling

### Before Expiry (30 days warning)
- Display warning banner
- Show days remaining
- Provide renewal information

### On Expiry
- Block all API requests (except license renewal)
- Display expiry message
- Require license renewal to continue

### After Expiry
- System remains locked
- Only license renewal endpoint accessible
- All other functionality disabled

## Renewal Process

1. Admin contacts BRIGHTSTEP TECHNOLOGIES
2. New license key provided
3. System validates new license
4. Expiry date updated
5. System access restored

## API Endpoints

### Activate License
```
POST /api/license/activate
Body: {
  license_key: string,
  company_name: string,
  contact_email: string,
  contact_phone: string
}
```

### Get License Status
```
GET /api/license/status
Response: {
  is_valid: boolean,
  expires_at: string,
  days_remaining: number,
  company_name: string
}
```

### Renew License
```
PUT /api/license/renew
Body: {
  license_key: string
}
```

## Frontend Integration

1. **License Status Check** on app load
2. **Warning Banner** when < 30 days remaining
3. **Expiry Modal** when license expires
4. **License Info** in admin settings

## Testing

1. Test license activation
2. Test expiry validation
3. Test renewal process
4. Test expiry blocking
5. Test warning displays

## Maintenance

- Regular license status checks
- Automatic expiry enforcement
- License renewal reminders
- Audit log monitoring
