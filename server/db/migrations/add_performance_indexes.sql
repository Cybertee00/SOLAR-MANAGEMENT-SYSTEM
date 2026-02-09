-- ============================================
-- Migration: Add Performance Indexes
-- ============================================
-- Description: Adds missing indexes on foreign keys and commonly queried columns
-- Impact: Improves query performance for common access patterns
-- Safe: Yes - indexes improve read performance, brief lock during creation
-- Created: 2026-02-06

-- Tasks table indexes
-- ====================

-- Foreign key to checklist_templates (used in template-based queries)
CREATE INDEX IF NOT EXISTS idx_tasks_checklist_template_id
  ON tasks(checklist_template_id)
  WHERE checklist_template_id IS NOT NULL;

COMMENT ON INDEX idx_tasks_checklist_template_id IS
  'Improves queries filtering tasks by template';

-- Foreign key to parent tasks (used for CM letter generation)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id
  ON tasks(parent_task_id)
  WHERE parent_task_id IS NOT NULL;

COMMENT ON INDEX idx_tasks_parent_task_id IS
  'Improves queries finding CM tasks generated from PM failures';

-- Composite index for organization filtering with status
-- Common pattern: "SELECT * FROM tasks WHERE organization_id = ? AND status = ?"
CREATE INDEX IF NOT EXISTS idx_tasks_org_status
  ON tasks(organization_id, status)
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_tasks_org_status IS
  'Improves dashboard queries filtering by organization and status';

-- Composite index for organization filtering with scheduled date
-- Common pattern: Dashboard queries filtering by org and scheduled date
CREATE INDEX IF NOT EXISTS idx_tasks_org_scheduled_date
  ON tasks(organization_id, scheduled_date)
  WHERE organization_id IS NOT NULL AND scheduled_date IS NOT NULL;

COMMENT ON INDEX idx_tasks_org_scheduled_date IS
  'Improves calendar queries filtering by organization and date';

-- Notifications table indexes
-- ============================

-- Composite index for user inbox queries
-- Common pattern: "SELECT * FROM notifications WHERE user_id = ? AND is_read = false"
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false;

COMMENT ON INDEX idx_notifications_user_unread IS
  'Improves user inbox queries for unread notifications';

-- Composite index for organization notifications
CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON notifications(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_notifications_org_created IS
  'Improves organization-wide notification queries';

-- Checklist Responses table indexes
-- ==================================

-- Foreign key to checklist_templates
CREATE INDEX IF NOT EXISTS idx_checklist_responses_template_id
  ON checklist_responses(checklist_template_id)
  WHERE checklist_template_id IS NOT NULL;

COMMENT ON INDEX idx_checklist_responses_template_id IS
  'Improves queries filtering responses by template';

-- CM Letters table indexes
-- =========================

-- Already has idx_cm_letters_parent_pm_task_id from base schema
-- Verify it exists and add if missing
CREATE INDEX IF NOT EXISTS idx_cm_letters_parent_pm_task_id
  ON cm_letters(parent_pm_task_id)
  WHERE parent_pm_task_id IS NOT NULL;

-- Display completion message
DO $$
BEGIN
  RAISE NOTICE 'Performance indexes created successfully';
  RAISE NOTICE 'Total indexes added: 9';
  RAISE NOTICE 'Affected tables: tasks (4), notifications (2), checklist_responses (1), cm_letters (1)';
END $$;
