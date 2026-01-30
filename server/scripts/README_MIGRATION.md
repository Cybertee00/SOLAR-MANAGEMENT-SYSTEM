# File Migration Script - Setup Instructions

## Database Connection Issue

If you encounter a "password authentication failed" error, the script needs proper database credentials.

## Solution

### Option 1: Use .env file (Recommended)

Ensure you have a `.env` file in the `server/` directory with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sphair_platform
DB_USER=postgres
DB_PASSWORD=your_actual_password
```

Then run the script from the `server/scripts/` directory:

```bash
cd server/scripts
node migrate-files-to-organization-folders.js
```

### Option 2: Set Environment Variables

Set environment variables before running:

**Windows (PowerShell):**
```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="sphair_platform"
$env:DB_USER="postgres"
$env:DB_PASSWORD="your_password"
node migrate-files-to-organization-folders.js
```

**Windows (CMD):**
```cmd
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=sphair_platform
set DB_USER=postgres
set DB_PASSWORD=your_password
node migrate-files-to-organization-folders.js
```

**Linux/Mac:**
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=sphair_platform
export DB_USER=postgres
export DB_PASSWORD=your_password
node migrate-files-to-organization-folders.js
```

### Option 3: Edit Script Directly (Not Recommended)

You can temporarily hardcode credentials in the script, but remember to remove them afterward:

```javascript
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'sphair_platform',
  user: 'postgres',
  password: 'your_password', // Change this
});
```

## What the Script Does

1. **Creates Organization Directories**: Sets up folder structure for all active organizations
2. **Migrates Images**: Moves task images to `organizations/{org_id}/images/`
3. **Migrates Profile Images**: Moves user profile images to `organizations/{org_id}/profiles/`
4. **Updates Database**: Updates file paths in database records
5. **Preserves Old Files**: Copies files (doesn't move) for safety

## Verification

After running the script, verify:

1. **Check Directories**: 
   ```bash
   ls -la server/uploads/organizations/
   ```

2. **Check Database**: Verify file paths are updated:
   ```sql
   SELECT image_path FROM failed_item_images LIMIT 10;
   SELECT profile_image FROM users WHERE profile_image IS NOT NULL LIMIT 10;
   ```

3. **Test File Serving**: Try accessing a migrated file via URL

## Troubleshooting

### "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### "Permission denied" errors
- Ensure the script has write permissions to `server/uploads/`
- Check database user has UPDATE permissions

### Files not found
- Old files might have been deleted already
- Check if files exist in old locations before migration
- Script will skip missing files and continue

### Database connection timeout
- Check PostgreSQL is running
- Verify firewall settings
- Check connection string is correct

## Important Notes

- **Backup First**: Always backup your database and uploads folder before running migration
- **Test Environment**: Run in test/staging first
- **Old Files**: Old files are copied, not moved. Delete manually after verification
- **Downtime**: Consider running during maintenance window for large migrations
