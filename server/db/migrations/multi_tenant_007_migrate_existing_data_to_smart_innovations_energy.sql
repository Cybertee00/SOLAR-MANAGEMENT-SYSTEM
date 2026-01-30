-- Migration: Multi-Tenant Step 7 - Migrate Existing Data to Smart Innovations Energy
-- This assigns all existing data to the Smart Innovations Energy organization
-- This ensures RLS policies work correctly and users can see their data
-- Note: Defensive - checks if tables/columns exist before updating

DO $$
DECLARE
  smart_innovations_energy_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  table_exists BOOLEAN;
  column_exists BOOLEAN;
BEGIN
  -- Ensure Smart Innovations Energy organization exists with correct name
  UPDATE organizations 
  SET name = 'Smart Innovations Energy', 
      slug = 'smart-innovations-energy',
      is_active = true,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = smart_innovations_energy_id;

  -- Assign all existing users to Smart Innovations Energy (except system_owner)
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE users 
    SET organization_id = smart_innovations_energy_id
    WHERE organization_id IS NULL
      AND (role != 'system_owner' AND (roles IS NULL OR roles::text NOT LIKE '%system_owner%'));
    RAISE NOTICE 'Updated users table';
  END IF;

  -- Assign all existing assets
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE assets SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated assets table';
  END IF;

  -- Assign all existing tasks
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE tasks SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated tasks table';
  END IF;

  -- Assign all existing checklist templates (each company owns their own templates)
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_templates' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE checklist_templates 
    SET organization_id = smart_innovations_energy_id, is_system_template = false
    WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated checklist_templates table';
  END IF;

  -- Assign all existing checklist responses
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_responses' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE checklist_responses SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated checklist_responses table';
  END IF;

  -- Assign all existing CM letters
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cm_letters' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE cm_letters SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated cm_letters table';
  END IF;

  -- Assign all existing inventory items
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE inventory_items SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated inventory_items table';
  END IF;

  -- Assign all existing inventory transactions
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_transactions' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE inventory_transactions SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated inventory_transactions table';
  END IF;

  -- Assign all existing inventory slips
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_slips' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE inventory_slips SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated inventory_slips table';
  END IF;

  -- Assign all existing calendar events
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE calendar_events SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated calendar_events table';
  END IF;

  -- Assign all existing overtime requests
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'overtime_requests' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE overtime_requests SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated overtime_requests table';
  END IF;

  -- Assign all existing API tokens
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_tokens' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE api_tokens SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated api_tokens table';
  END IF;

  -- Assign all existing webhooks
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhooks' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    UPDATE webhooks SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated webhooks table';
  END IF;

  -- Assign all existing task assignments
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_assignments' AND column_name = 'organization_id') INTO column_exists;
  IF column_exists THEN
    -- Derive from task if possible
    UPDATE task_assignments ta
    SET organization_id = t.organization_id
    FROM tasks t
    WHERE ta.task_id = t.id AND ta.organization_id IS NULL;
    
    -- Fallback for remaining
    UPDATE task_assignments SET organization_id = smart_innovations_energy_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Updated task_assignments table';
  END IF;

  RAISE NOTICE 'Migration complete: All existing data assigned to Smart Innovations Energy';
END $$;
