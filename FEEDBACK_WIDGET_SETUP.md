# Feedback Widget Setup Guide

## Database Migration Required

The feedback widget requires a database table. You need to run the migration, but first you need to fix your database credentials.

## Fix Database Connection

The error shows that your PostgreSQL password doesn't match. Here are your options:

### Option 1: Update .env File
1. Check your `.env` file in the project root
2. Update the `DB_PASSWORD` to match your actual PostgreSQL password:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=solar_om_db
   DB_USER=postgres
   DB_PASSWORD=your_actual_postgres_password
   ```

### Option 2: Run Migration Manually
If you can't update the .env file, you can run the migration directly in PostgreSQL:

1. Connect to your database using psql or pgAdmin
2. Run the SQL file:
   ```sql
   -- Copy and paste the contents of:
   -- server/db/migrations/add_feedback_table.sql
   ```

### Option 3: Check Your PostgreSQL Setup
If you're using Docker:
```bash
# Check your docker-compose.yml for the postgres password
# Or check if PostgreSQL is running:
docker ps | grep postgres
```

## After Fixing Database Connection

Once your database credentials are correct, run:
```bash
cd server/scripts
node setup-db.js
```

This will automatically create the `feedback_submissions` table.

## Manual Migration (Alternative)

If you prefer to run the migration manually:

1. Connect to your PostgreSQL database
2. Run this SQL:

```sql
CREATE TABLE IF NOT EXISTS feedback_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(50) NOT NULL CHECK (subject IN ('bug', 'feature', 'question', 'improvement', 'other')),
    message TEXT NOT NULL,
    page_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_submissions(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_subject ON feedback_submissions(subject);
```

## Verify Installation

After the migration runs successfully, you should see:
- ✅ Migration `add_feedback_table.sql` applied successfully

## Testing the Widget

1. **Restart your server** to load the new route
2. **Restart your React app** (if needed)
3. **Log in** to the application
4. **Look for the message icon** in the bottom-right corner
5. **Click it** to open the feedback form
6. **Submit a test feedback** to verify it works

## Troubleshooting

### Widget not showing?
- Make sure you're logged in (it only shows on authenticated pages)
- Check browser console for errors
- Verify the component is imported in `App.js`

### Can't submit feedback?
- Check server logs for errors
- Verify the database table exists: `SELECT * FROM feedback_submissions LIMIT 1;`
- Check that the route is registered in `server/index.js`

### Database connection issues?
- Verify PostgreSQL is running
- Check `.env` file has correct credentials
- Test connection: `psql -U postgres -d solar_om_db`
