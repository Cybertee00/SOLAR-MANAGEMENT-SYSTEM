# Multiple Task Assignments Implementation

## Overview

The system now supports assigning tasks to **multiple users** instead of just one. This allows for collaborative task management where teams can work together on tasks.

## Database Changes

### Migration Required

Run the migration to create the `task_assignments` junction table:

```bash
cd server
node scripts/run-migration.js add_multiple_task_assignments.sql
```

### What the Migration Does

1. Creates `task_assignments` table (many-to-many relationship)
2. Migrates existing single assignments to the new table
3. Keeps `assigned_to` column for backward compatibility (stores primary assignee)

## Backend Changes

### API Updates

- **Task Creation**: Accepts `assigned_to` as either:
  - Single user ID (string)
  - Array of user IDs (array)
  - `null` or empty (unassigned)

- **Task Retrieval**: Returns `assigned_users` array with full user details

- **Notifications**: Sends email and in-app notifications to **all** assigned users

### Example API Request

```json
{
  "checklist_template_id": "...",
  "asset_id": "...",
  "assigned_to": ["user-id-1", "user-id-2", "user-id-3"],
  "task_type": "PM",
  "scheduled_date": "2024-01-15"
}
```

## Frontend Changes

### Task Creation Form

- Changed from **dropdown** to **checkbox list**
- Users can select multiple users by checking boxes
- Shows count of selected users
- All selected users will receive notifications

### Task Display

- Tasks table shows all assigned users (one per line)
- Task detail page shows all assigned users with emails
- Users can see tasks assigned to them (even if multiple users assigned)

## Features

### ✅ Multiple User Assignment
- Select 1 or more users when creating a task
- All selected users receive notifications
- All assigned users can view and work on the task

### ✅ Notifications
- **Email**: Sent to all assigned users
- **In-App**: Created for all assigned users
- **Reminders**: Sent to all assigned users 3 days before scheduled date

### ✅ Task Visibility
- Users see tasks assigned to them (even if others are also assigned)
- Admins see all tasks with all assigned users
- Task filtering works correctly for multiple assignments

## Migration Steps

1. **Backup your database** (recommended)

2. **Run the migration**:
   ```bash
   cd server
   node scripts/run-migration.js add_multiple_task_assignments.sql
   ```

3. **Restart the server** to pick up schema changes

4. **Test**:
   - Create a task with multiple users
   - Verify all users receive notifications
   - Verify all users can see the task

## Backward Compatibility

- Existing tasks with single assignments are automatically migrated
- The `assigned_to` column is kept for backward compatibility
- Old API calls with single `assigned_to` still work
- Frontend gracefully handles both old and new data formats

## Notes

- Tasks can be assigned to **0, 1, or more users**
- Unassigned tasks show "Unassigned" in the UI
- All assigned users have equal access to the task
- Notifications are sent to all assigned users simultaneously
