-- ============================================
-- Rollback: Add Performance Indexes
-- ============================================
-- Use this to remove the performance indexes if needed

-- Drop tasks table indexes
DROP INDEX IF EXISTS idx_tasks_checklist_template_id;
DROP INDEX IF EXISTS idx_tasks_parent_task_id;
DROP INDEX IF EXISTS idx_tasks_org_status;
DROP INDEX IF EXISTS idx_tasks_org_scheduled_date;

-- Drop notifications table indexes
DROP INDEX IF EXISTS idx_notifications_user_unread;
DROP INDEX IF EXISTS idx_notifications_org_created;

-- Drop checklist_responses table indexes
DROP INDEX IF EXISTS idx_checklist_responses_template_id;

-- Drop cm_letters table indexes (if we added it)
-- Note: idx_cm_letters_parent_pm_task_id may already exist from base schema
-- Only drop if you're sure it was created by this migration
-- DROP INDEX IF EXISTS idx_cm_letters_parent_pm_task_id;

-- Display completion message
DO $$
BEGIN
  RAISE NOTICE 'Performance indexes removed successfully';
END $$;
