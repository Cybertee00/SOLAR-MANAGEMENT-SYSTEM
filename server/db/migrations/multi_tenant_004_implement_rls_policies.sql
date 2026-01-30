-- Migration: Multi-Tenant Step 4 - Implement Row-Level Security (RLS) Policies
-- This enables data isolation at the database level using PostgreSQL RLS

-- Enable RLS on all tenant-scoped tables
-- Note: System users (system_owner) bypass RLS via application logic

-- Function to get current organization_id from session
-- This will be set by the application middleware
CREATE OR REPLACE FUNCTION get_current_organization_id() 
RETURNS UUID AS $$
BEGIN
  -- Get organization_id from session variable set by application
  -- Returns NULL if not set (for system users)
  RETURN NULLIF(current_setting('app.current_organization_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Users table RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_organization_isolation ON users;
CREATE POLICY users_organization_isolation ON users
  USING (
    -- System users (system_owner) can see all users
    -- Regular users can only see users in their organization
    organization_id = get_current_organization_id()
    OR organization_id IS NULL  -- System users
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
      AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
    )
  );

-- Assets table RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assets_organization_isolation ON assets;
CREATE POLICY assets_organization_isolation ON assets
  USING (
    -- Regular users: Only see assets from their organization
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    -- System owners: Can see all assets (including NULL organization_id)
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Tasks table RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_organization_isolation ON tasks;
CREATE POLICY tasks_organization_isolation ON tasks
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Checklist Templates table RLS
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checklist_templates_organization_isolation ON checklist_templates;
CREATE POLICY checklist_templates_organization_isolation ON checklist_templates
  USING (
    -- Users can see:
    -- 1. Templates from their organization
    -- 2. System templates (organization_id IS NULL AND is_system_template = true)
    organization_id = get_current_organization_id()
    OR (organization_id IS NULL AND is_system_template = true)
  );

-- Checklist Responses table RLS
ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checklist_responses_organization_isolation ON checklist_responses;
CREATE POLICY checklist_responses_organization_isolation ON checklist_responses
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- CM Letters table RLS
ALTER TABLE cm_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cm_letters_organization_isolation ON cm_letters;
CREATE POLICY cm_letters_organization_isolation ON cm_letters
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Inventory Items table RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_items_organization_isolation ON inventory_items;
CREATE POLICY inventory_items_organization_isolation ON inventory_items
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Inventory Slips table RLS
ALTER TABLE inventory_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_slips_organization_isolation ON inventory_slips;
CREATE POLICY inventory_slips_organization_isolation ON inventory_slips
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Notifications table RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_organization_isolation ON notifications;
CREATE POLICY notifications_organization_isolation ON notifications
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Plant Map Structure table RLS
ALTER TABLE plant_map_structure ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plant_map_structure_organization_isolation ON plant_map_structure;
CREATE POLICY plant_map_structure_organization_isolation ON plant_map_structure
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Tracker Status Requests table RLS
ALTER TABLE tracker_status_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracker_status_requests_organization_isolation ON tracker_status_requests;
CREATE POLICY tracker_status_requests_organization_isolation ON tracker_status_requests
  USING (
    (get_current_organization_id() IS NOT NULL AND organization_id = get_current_organization_id())
    OR
    (
      get_current_organization_id() IS NULL 
      AND EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = (SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID)
        AND (u.role = 'system_owner' OR u.roles::text LIKE '%system_owner%')
      )
    )
  );

-- Add comments
COMMENT ON FUNCTION get_current_organization_id() IS 
  'Returns the current organization_id from session variable. Used by RLS policies for data isolation.';
