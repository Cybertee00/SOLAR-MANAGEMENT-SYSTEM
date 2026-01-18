# License Schema Migration Guide

**Version:** 1.0  
**Date:** January 2026  
**Migration:** `add_multi_tenant_license_fields.sql`

---

## Overview

This migration adds multi-tenant support and advanced license features to the existing `licenses` table. The migration is **safe** and **backward compatible** - existing licenses will continue to work.

---

## What This Migration Adds

### New Columns

1. **`company_id`** (UUID, nullable)
   - Multi-tenant support
   - Links license to company (when companies table exists)

2. **`license_token`** (TEXT, nullable)
   - Stores full signed license token
   - Enables offline validation

3. **`license_tier`** (VARCHAR(50), default: 'small')
   - License tier: small, medium, large, enterprise
   - Constraint: must be one of the allowed values

4. **`license_type`** (VARCHAR(50), default: 'subscription')
   - License type: trial, subscription, perpetual
   - Constraint: must be one of the allowed values

5. **`features`** (JSONB, default: '[]')
   - Array of enabled feature codes
   - Example: `["white_labeling", "api_access"]`

6. **`is_revoked`** (BOOLEAN, default: false)
   - Whether license is revoked

7. **`revoked_at`** (TIMESTAMP, nullable)
   - When license was revoked

8. **`revoked_reason`** (TEXT, nullable)
   - Reason for revocation

9. **`issued_at`** (TIMESTAMP, nullable)
   - When license was originally issued

10. **`metadata`** (JSONB, default: '{}')
    - Additional license metadata

### New Indexes

- `idx_licenses_company_id` - For company-based queries
- `idx_licenses_license_tier` - For tier-based queries
- `idx_licenses_license_type` - For type-based queries
- `idx_licenses_is_revoked` - For revocation checks
- `idx_licenses_expires_at_is_active` - Composite index for active license queries

---

## Prerequisites

1. **Licenses table must exist**
   - Run `create_licenses_table.sql` first if needed
   - Check: `SELECT * FROM licenses LIMIT 1;`

2. **Database connection**
   - Valid database credentials
   - ALTER TABLE permissions

3. **Backup** (recommended)
   - Backup database before migration
   - Especially if you have existing licenses

---

## Running the Migration

### Option 1: Using npm script (Recommended)

```bash
cd server
npm run migrate-license
```

### Option 2: Direct node command

```bash
node server/scripts/migrate-license-schema.js
```

### Option 3: With custom database credentials

```bash
node server/scripts/migrate-license-schema.js \
  --user=postgres \
  --password=yourpassword \
  --host=localhost \
  --port=5432 \
  --database=solar_om_db
```

### Option 4: Using environment variables

Create/update `.env` file:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=solar_om_db
DB_USER=postgres
DB_PASSWORD=yourpassword
```

Then run:
```bash
node server/scripts/migrate-license-schema.js
```

---

## Migration Process

The migration script will:

1. ✅ Check if `licenses` table exists
2. ✅ Check for existing columns (to avoid conflicts)
3. ✅ Run migration SQL (with IF NOT EXISTS for safety)
4. ✅ Update existing licenses with default values
5. ✅ Create indexes
6. ✅ Verify migration success
7. ✅ Report existing license count

---

## What Happens to Existing Licenses

Existing licenses are **automatically updated** with:

- `license_tier` = 'small' (if not set)
- `license_type` = 'subscription' (if not set)
- `features` = '[]' (empty array)
- `is_revoked` = false
- `metadata` = '{}' (empty object)
- `issued_at` = `created_at` (copied from created_at)

**No data loss** - all existing license data is preserved.

---

## Verification

After migration, verify with:

```sql
-- Check new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'licenses'
ORDER BY ordinal_position;

-- Check existing licenses
SELECT 
  id, 
  company_name, 
  license_tier, 
  license_type, 
  is_revoked,
  expires_at
FROM licenses;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'licenses';
```

---

## Rollback (If Needed)

If you need to rollback (not recommended after production use):

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_licenses_company_id;
DROP INDEX IF EXISTS idx_licenses_license_tier;
DROP INDEX IF EXISTS idx_licenses_license_type;
DROP INDEX IF EXISTS idx_licenses_is_revoked;
DROP INDEX IF EXISTS idx_licenses_expires_at_is_active;

-- Remove columns (WARNING: This will delete data)
ALTER TABLE licenses DROP COLUMN IF EXISTS company_id;
ALTER TABLE licenses DROP COLUMN IF EXISTS license_token;
ALTER TABLE licenses DROP COLUMN IF EXISTS license_tier;
ALTER TABLE licenses DROP COLUMN IF EXISTS license_type;
ALTER TABLE licenses DROP COLUMN IF EXISTS features;
ALTER TABLE licenses DROP COLUMN IF EXISTS is_revoked;
ALTER TABLE licenses DROP COLUMN IF EXISTS revoked_at;
ALTER TABLE licenses DROP COLUMN IF EXISTS revoked_reason;
ALTER TABLE licenses DROP COLUMN IF EXISTS issued_at;
ALTER TABLE licenses DROP COLUMN IF EXISTS metadata;
```

**⚠️ WARNING:** Only rollback if absolutely necessary. This will delete all data in the new columns.

---

## Troubleshooting

### Error: "licenses table does not exist"

**Solution:** Run the licenses table creation migration first:
```bash
node server/scripts/run-migration.js create_licenses_table.sql
```

### Error: "permission denied"

**Solution:** Ensure database user has ALTER TABLE permissions:
```sql
GRANT ALL PRIVILEGES ON TABLE licenses TO your_user;
```

### Error: "column already exists"

**Solution:** This is safe - the migration uses `IF NOT EXISTS`. The column already exists, so it's skipped.

### Error: "constraint already exists"

**Solution:** This is safe - the migration uses `IF NOT EXISTS`. The constraint already exists, so it's skipped.

---

## Post-Migration Steps

1. **Set LICENSE_SIGNING_SECRET**
   ```bash
   # Generate secret
   openssl rand -hex 32
   
   # Add to .env
   LICENSE_SIGNING_SECRET=<generated-secret>
   ```

2. **Test License Generation**
   ```bash
   # Generate a test license token
   curl -X POST http://localhost:3001/api/license/generate \
     -H "Content-Type: application/json" \
     -d '{"company_name": "Test Company", "tier": "small"}'
   ```

3. **Verify License Validation**
   - Check that existing licenses still work
   - Test new license activation with tokens
   - Verify revocation mechanism

---

## Migration Output Example

```
========================================
License Schema Migration
========================================

Database configuration:
  Host: localhost
  Port: 5432
  Database: solar_om_db
  User: postgres
  Password: ***

Checking if licenses table exists...
✅ licenses table found

Checking existing columns...
✅ No existing columns found. Migration will add all new fields.

📄 Running migration: add_multi_tenant_license_fields.sql
   This will add:
   - company_id (multi-tenant support)
   - license_token (signed token storage)
   - license_tier (small/medium/large/enterprise)
   - license_type (trial/subscription/perpetual)
   - features (JSONB array)
   - is_revoked, revoked_at, revoked_reason (revocation)
   - issued_at (issue timestamp)
   - metadata (JSONB for additional data)
   - Indexes for performance

✅ Migration applied successfully!

Verifying migration...
✅ All expected columns found

📊 Existing licenses: 1
✅ Existing licenses will be updated with default values
   - license_tier: small
   - license_type: subscription
   - features: []
   - is_revoked: false
   - issued_at: set from created_at

========================================
✅ Migration completed successfully!
========================================

Next steps:
1. Set LICENSE_SIGNING_SECRET in your .env file
   Generate with: openssl rand -hex 32
2. Test license token generation
3. Generate new licenses using the new token format
```

---

## Support

If you encounter issues:

1. Check database connection
2. Verify licenses table exists
3. Check database user permissions
4. Review error messages for specific issues
5. Ensure PostgreSQL version is 12+ (for JSONB support)

---

**Document Version:** 1.0  
**Last Updated:** January 2026
