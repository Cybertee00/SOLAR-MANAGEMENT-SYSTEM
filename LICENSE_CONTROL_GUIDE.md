# License Control and Management Guide

## Overview

This guide explains how BRIGHTSTEP TECHNOLOGIES Pty Ltd can generate, manage, and maintain control over SPHAiRPlatform licenses.

## License Generation

### Method 1: Using the Admin Interface (Recommended)

1. **Access License Management**
   - Log in as an Admin user
   - Navigate to "License Management" in the navigation menu
   - Click "Generate License Key" button

2. **Generate Key**
   - Enter the company name
   - Click "Generate"
   - Copy the generated license key
   - Provide it to the customer

### Method 2: Using Command Line Script

1. **Run the generation script:**
   ```bash
   node scripts/generate-license.js "Company Name"
   ```

2. **Example:**
   ```bash
   node scripts/generate-license.js "SIE Management System"
   ```

3. **Output:**
   - License key in format: `SPHAIR-XXXX-XXXX-XXXX-XXXX`
   - Expiry date (90 days from generation)
   - Company name

## License Activation Process

### For Customers:

1. Customer receives license key from BRIGHTSTEP TECHNOLOGIES
2. Admin logs into SPHAiRPlatform
3. Navigates to "License Management"
4. Clicks "Activate License"
5. Enters:
   - License key
   - Company name
   - Contact email (optional)
   - Contact phone (optional)
6. Clicks "Activate"
7. System validates and activates license
8. License expires 90 days from activation

## Maintaining Control

### 1. License Expiry Enforcement

- **Automatic Blocking**: System automatically blocks all API requests when license expires
- **Frontend Warnings**: Users see warning banners 30 days before expiry
- **No Bypass**: License validation is server-side only, cannot be bypassed

### 2. License Renewal Process

1. **Customer contacts BRIGHTSTEP TECHNOLOGIES** for renewal
2. **Generate new license key** using admin interface or script
3. **Provide key to customer**
4. **Customer renews** via "Renew License" in License Management
5. **System extends** license for another 90 days

### 3. Monitoring License Status

As BRIGHTSTEP TECHNOLOGIES, you can:

- **Check License Status**: Use admin interface to view current license
- **Track Expiry Dates**: Monitor when licenses are expiring
- **Generate Reports**: Export license information for record-keeping

### 4. License Database

All licenses are stored in the `licenses` table:

```sql
SELECT 
  id,
  company_name,
  contact_email,
  activated_at,
  expires_at,
  is_active
FROM licenses
ORDER BY expires_at;
```

## Security Measures

### 1. License Key Security

- **Hashed Storage**: License keys are hashed (SHA-256) before storage
- **Unique Keys**: Each key is cryptographically unique
- **Format Validation**: Keys must match `SPHAIR-XXXX-XXXX-XXXX-XXXX` format

### 2. Server-Side Validation

- **Middleware Protection**: All protected routes require valid license
- **No Client Bypass**: Validation happens server-side only
- **Automatic Enforcement**: System blocks access when expired

### 3. Access Control

- **Admin Only**: License management restricted to admin users
- **Audit Trail**: License operations are logged
- **Secure Storage**: License data stored in secure database

## Best Practices

### 1. License Key Management

- **Keep Records**: Maintain a database of all issued license keys
- **Track Companies**: Record company name, contact info, and expiry dates
- **Secure Storage**: Store license keys securely (encrypted if possible)

### 2. Customer Communication

- **Proactive Renewal**: Contact customers 30 days before expiry
- **Clear Instructions**: Provide clear activation/renewal instructions
- **Support**: Be available to assist with license issues

### 3. System Monitoring

- **Regular Checks**: Periodically check license status
- **Expiry Alerts**: Set up alerts for upcoming expiries
- **Usage Tracking**: Monitor system usage and license compliance

## Troubleshooting

### License Not Activating

1. **Check Format**: Ensure license key matches `SPHAIR-XXXX-XXXX-XXXX-XXXX`
2. **Check Duplicates**: Verify key hasn't been used before
3. **Check Database**: Ensure database connection is working

### License Expired

1. **Generate New Key**: Create new license key for customer
2. **Customer Renews**: Customer uses "Renew License" feature
3. **Verify Activation**: Confirm license is active after renewal

### System Access Blocked

1. **Check License Status**: Verify license hasn't expired
2. **Check Middleware**: Ensure license middleware is active
3. **Check Database**: Verify license record exists and is active

## API Endpoints for License Management

### Generate License Key (Admin Only)
```
POST /api/license/generate
Body: { "company_name": "Company Name" }
```

### Activate License (Admin Only)
```
POST /api/license/activate
Body: {
  "license_key": "SPHAIR-XXXX-XXXX-XXXX-XXXX",
  "company_name": "Company Name",
  "contact_email": "email@example.com",
  "contact_phone": "+1234567890"
}
```

### Get License Status (Public)
```
GET /api/license/status
```

### Get License Info (Admin Only)
```
GET /api/license/info
```

### Renew License (Admin Only)
```
PUT /api/license/renew
Body: { "license_key": "SPHAIR-XXXX-XXXX-XXXX-XXXX" }
```

## License Control Checklist

- [ ] License generation script available
- [ ] Admin interface for license management
- [ ] License validation middleware active
- [ ] Frontend warnings configured
- [ ] Database migration completed
- [ ] License records maintained
- [ ] Customer communication process established
- [ ] Renewal process documented
- [ ] Security measures implemented

## Contact Information

For license-related inquiries:
- **Platform**: SPHAiRPlatform
- **Owner**: BRIGHTSTEP TECHNOLOGIES Pty Ltd
- **Tagline**: "One Platform. Every Task."

## Notes

- Licenses expire 90 days (3 months) from activation
- License keys are unique and cannot be reused
- System automatically enforces license expiry
- All license operations require admin privileges
- License data is stored securely in the database
