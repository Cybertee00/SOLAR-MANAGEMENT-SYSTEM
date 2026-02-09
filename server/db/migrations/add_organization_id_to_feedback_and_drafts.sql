-- ============================================
-- Migration: Add organization_id to feedback_submissions and draft_checklist_responses
-- ============================================
-- These tables were missed in multi_tenant_006 migration
-- Adding organization_id for proper multi-tenant data isolation

DO $$
DECLARE
  default_org_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  table_exists BOOLEAN;
BEGIN
  -- feedback_submissions table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_submissions') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feedback_submissions' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE feedback_submissions
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Derive from user if possible
    UPDATE feedback_submissions fs
    SET organization_id = u.organization_id
    FROM users u
    WHERE fs.user_id = u.id AND fs.organization_id IS NULL AND u.organization_id IS NOT NULL;

    -- Fallback for remaining
    UPDATE feedback_submissions SET organization_id = default_org_id WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_feedback_submissions_organization_id ON feedback_submissions(organization_id);
    RAISE NOTICE 'Added organization_id to feedback_submissions table';
  END IF;

  -- draft_checklist_responses table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'draft_checklist_responses') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'draft_checklist_responses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE draft_checklist_responses
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Derive from task if possible
    UPDATE draft_checklist_responses dcr
    SET organization_id = t.organization_id
    FROM tasks t
    WHERE dcr.task_id = t.id AND dcr.organization_id IS NULL AND t.organization_id IS NOT NULL;

    -- Fallback for remaining
    UPDATE draft_checklist_responses SET organization_id = default_org_id WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_draft_checklist_responses_organization_id ON draft_checklist_responses(organization_id);
    RAISE NOTICE 'Added organization_id to draft_checklist_responses table';
  END IF;

  RAISE NOTICE 'Migration complete: organization_id added to feedback_submissions and draft_checklist_responses';
END $$;
