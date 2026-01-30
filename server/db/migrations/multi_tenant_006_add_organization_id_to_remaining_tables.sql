-- Migration: Multi-Tenant Step 6 - Add organization_id to Remaining Tables
-- This adds organization_id column to all tables that don't have it yet
-- These tables are critical for data isolation
-- Note: Checks if table exists before attempting to modify

-- Default organization ID (Smart Innovations Energy)
DO $$
DECLARE
  default_org_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  table_exists BOOLEAN;
BEGIN
  -- Tasks table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE tasks 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE tasks SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE tasks ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
    RAISE NOTICE 'Added organization_id to tasks table';
  END IF;

  -- Checklist Responses table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_responses') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checklist_responses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE checklist_responses 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE checklist_responses SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE checklist_responses ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_checklist_responses_organization_id ON checklist_responses(organization_id);
    RAISE NOTICE 'Added organization_id to checklist_responses table';
  END IF;

  -- CM Letters table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cm_letters') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cm_letters' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE cm_letters 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE cm_letters SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE cm_letters ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_cm_letters_organization_id ON cm_letters(organization_id);
    RAISE NOTICE 'Added organization_id to cm_letters table';
  END IF;

  -- Inventory Items table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE inventory_items 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE inventory_items SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE inventory_items ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_inventory_items_organization_id ON inventory_items(organization_id);
    RAISE NOTICE 'Added organization_id to inventory_items table';
  END IF;

  -- Inventory Transactions table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_transactions') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_transactions' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE inventory_transactions 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE inventory_transactions SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE inventory_transactions ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_organization_id ON inventory_transactions(organization_id);
    RAISE NOTICE 'Added organization_id to inventory_transactions table';
  END IF;

  -- Inventory Slips table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_slips') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_slips' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE inventory_slips 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE inventory_slips SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE inventory_slips ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_inventory_slips_organization_id ON inventory_slips(organization_id);
    RAISE NOTICE 'Added organization_id to inventory_slips table';
  END IF;

  -- Calendar Events table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE calendar_events 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE calendar_events SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE calendar_events ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_calendar_events_organization_id ON calendar_events(organization_id);
    RAISE NOTICE 'Added organization_id to calendar_events table';
  END IF;

  -- Overtime Requests table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'overtime_requests') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'overtime_requests' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE overtime_requests 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE overtime_requests SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE overtime_requests ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_overtime_requests_organization_id ON overtime_requests(organization_id);
    RAISE NOTICE 'Added organization_id to overtime_requests table';
  END IF;

  -- API Tokens table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_tokens') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_tokens' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE api_tokens 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE api_tokens SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE api_tokens ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_api_tokens_organization_id ON api_tokens(organization_id);
    RAISE NOTICE 'Added organization_id to api_tokens table';
  END IF;

  -- Webhooks table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhooks') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhooks' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE webhooks 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    UPDATE webhooks SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE webhooks ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks(organization_id);
    RAISE NOTICE 'Added organization_id to webhooks table';
  END IF;

  -- Task Assignments table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_assignments') INTO table_exists;
  IF table_exists AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_assignments' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE task_assignments 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Derive from task if possible
    UPDATE task_assignments ta
    SET organization_id = t.organization_id
    FROM tasks t
    WHERE ta.task_id = t.id AND ta.organization_id IS NULL;
    
    -- Fallback for remaining
    UPDATE task_assignments SET organization_id = default_org_id WHERE organization_id IS NULL;
    ALTER TABLE task_assignments ALTER COLUMN organization_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_task_assignments_organization_id ON task_assignments(organization_id);
    RAISE NOTICE 'Added organization_id to task_assignments table';
  END IF;

  RAISE NOTICE 'Migration complete: organization_id columns added to tables';
END $$;
