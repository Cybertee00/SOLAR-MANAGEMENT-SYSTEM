# Quick Start: License Generation and Control

## For BRIGHTSTEP TECHNOLOGIES Pty Ltd

### How to Generate a License Key

#### Option 1: Using Admin Interface (Easiest)

1. **Log in** to SPHAiRPlatform as an Admin
2. **Click** "License" in the navigation menu
3. **Click** "Generate License Key" button
4. **Enter** the company name
5. **Click** "Generate"
6. **Copy** the generated license key
7. **Provide** it to the customer

#### Option 2: Using Command Line

```bash
cd D:\PJs\ChecksheetsApp
node scripts/generate-license.js "Company Name"
```

**Example:**
```bash
node scripts/generate-license.js "SIE Management System"
```

**Output:**
```
========================================
SPHAiRPlatform License Key Generator
BRIGHTSTEP TECHNOLOGIES Pty Ltd
========================================

Company Name: SIE Management System
License Key: SPHAIR-A1B2-C3D4-E5F6-G7H8
Expires: 2026-04-12
Duration: 90 days (3 months)

========================================
```

### How to Maintain Control

#### 1. License Expiry is Automatic

- ✅ System **automatically blocks** all access when license expires
- ✅ Users see **warning banners** 30 days before expiry
- ✅ **No bypass possible** - validation is server-side only

#### 2. Monitor License Status

1. **Log in** as Admin
2. **Go to** "License" in navigation
3. **View** current license status:
   - Company name
   - Expiry date
   - Days remaining
   - Contact information

#### 3. Renew Licenses

When a customer needs renewal:

1. **Generate** new license key (using interface or script)
2. **Provide** key to customer
3. **Customer activates** via "Renew License" in License Management
4. **System extends** license for another 90 days

### License Management Features

#### What You Can Do:

- ✅ **Generate** new license keys
- ✅ **View** all license information
- ✅ **Monitor** expiry dates
- ✅ **Track** company details
- ✅ **Renew** expired licenses

#### What Customers Can Do:

- ✅ **Activate** their license (one-time)
- ✅ **View** license status
- ✅ **Renew** when expired (with new key from you)

### Security Features

- 🔒 License keys are **hashed** before storage
- 🔒 **Server-side validation** only (cannot be bypassed)
- 🔒 **Automatic expiry** enforcement
- 🔒 **Admin-only** license management

### Important Notes

1. **License Duration**: 90 days (3 months) from activation
2. **Unique Keys**: Each license key can only be used once
3. **No Reuse**: Expired licenses cannot be reactivated with the same key
4. **Renewal Required**: Customers must renew with a new key from you

### Quick Reference

| Action | Method | Location |
|--------|--------|----------|
| Generate Key | Admin Interface | License Management → Generate |
| Generate Key | Command Line | `node scripts/generate-license.js "Company"` |
| View Status | Admin Interface | License Management |
| Activate License | Customer | License Management → Activate |
| Renew License | Customer | License Management → Renew |

### Need Help?

- **Documentation**: See `LICENSE_CONTROL_GUIDE.md` for detailed guide
- **System Docs**: See `LICENSE_SYSTEM.md` for technical details
- **API Docs**: See `LICENSE_CONTROL_GUIDE.md` for API endpoints

---

**Platform**: SPHAiRPlatform  
**Owner**: BRIGHTSTEP TECHNOLOGIES Pty Ltd  
**Tagline**: "One Platform. Every Task."
