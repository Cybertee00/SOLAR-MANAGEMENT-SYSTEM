-- RBAC System Migration
-- Creates roles, permissions, and role_permissions tables
-- Implements comprehensive role-based access control

-- Permissions table - defines all available permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code VARCHAR(100) UNIQUE NOT NULL,
    permission_name VARCHAR(255) NOT NULL,
    resource VARCHAR(100) NOT NULL, -- e.g., 'tasks', 'inventory', 'users', 'templates'
    action VARCHAR(50) NOT NULL, -- e.g., 'create', 'read', 'update', 'delete', 'execute', 'approve'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table - defines all available roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code VARCHAR(50) UNIQUE NOT NULL,
    role_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE, -- System roles cannot be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permission mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- User-Role mapping table (supports multiple roles per user)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(permission_code);

-- Insert default roles
INSERT INTO roles (role_code, role_name, description, is_system_role) VALUES
    ('system_owner', 'System Owner', 'Full system access and control. Can manage all aspects of the platform.', TRUE),
    ('operations_admin', 'Operations Administrator', 'Manages daily operations, users, and system configuration. High-level administrative access.', TRUE),
    ('supervisor', 'Supervisor', 'Oversees work execution, approves requests, and reviews completed tasks. Can assign and manage tasks.', TRUE),
    ('technician', 'Technician', 'Performs maintenance tasks, completes checklists, and updates task status. Technical operations role.', TRUE),
    ('general_worker', 'General Worker', 'Basic access to view assigned tasks and submit work. Limited to assigned work only.', TRUE),
    ('inventory_controller', 'Inventory Controller', 'Manages inventory, spares, and stock levels. Can update inventory and approve spare requests.', TRUE)
ON CONFLICT (role_code) DO NOTHING;

-- Insert permissions for all resources and actions
-- Tasks permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('tasks:create', 'Create Tasks', 'tasks', 'create', 'Create new PM or CM tasks'),
    ('tasks:read', 'View Tasks', 'tasks', 'read', 'View task list and details'),
    ('tasks:update', 'Update Tasks', 'tasks', 'update', 'Update task information and status'),
    ('tasks:delete', 'Delete Tasks', 'tasks', 'delete', 'Delete tasks'),
    ('tasks:assign', 'Assign Tasks', 'tasks', 'execute', 'Assign tasks to users'),
    ('tasks:approve', 'Approve Tasks', 'tasks', 'approve', 'Approve task completion'),
    ('tasks:execute', 'Execute Tasks', 'tasks', 'execute', 'Start, pause, resume, and complete tasks')
ON CONFLICT (permission_code) DO NOTHING;

-- Templates permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('templates:create', 'Create Templates', 'templates', 'create', 'Create new checklist templates'),
    ('templates:read', 'View Templates', 'templates', 'read', 'View checklist templates'),
    ('templates:update', 'Update Templates', 'templates', 'update', 'Update checklist templates'),
    ('templates:delete', 'Delete Templates', 'templates', 'delete', 'Delete checklist templates')
ON CONFLICT (permission_code) DO NOTHING;

-- Inventory permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('inventory:create', 'Create Inventory Items', 'inventory', 'create', 'Add new inventory items'),
    ('inventory:read', 'View Inventory', 'inventory', 'read', 'View inventory items and stock levels'),
    ('inventory:update', 'Update Inventory', 'inventory', 'update', 'Update inventory quantities and details'),
    ('inventory:delete', 'Delete Inventory Items', 'inventory', 'delete', 'Delete inventory items'),
    ('inventory:approve', 'Approve Spare Requests', 'inventory', 'approve', 'Approve or reject spare part requests')
ON CONFLICT (permission_code) DO NOTHING;

-- Users permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('users:create', 'Create Users', 'users', 'create', 'Create new user accounts'),
    ('users:read', 'View Users', 'users', 'read', 'View user list and profiles'),
    ('users:update', 'Update Users', 'users', 'update', 'Update user information and roles'),
    ('users:delete', 'Delete Users', 'users', 'delete', 'Delete user accounts'),
    ('users:manage_roles', 'Manage User Roles', 'users', 'execute', 'Assign and modify user roles')
ON CONFLICT (permission_code) DO NOTHING;

-- CM Letters permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('cm_letters:create', 'Create CM Letters', 'cm_letters', 'create', 'Create corrective maintenance letters'),
    ('cm_letters:read', 'View CM Letters', 'cm_letters', 'read', 'View CM letter list and details'),
    ('cm_letters:update', 'Update CM Letters', 'cm_letters', 'update', 'Update CM letter information'),
    ('cm_letters:delete', 'Delete CM Letters', 'cm_letters', 'delete', 'Delete CM letters'),
    ('cm_letters:download', 'Download CM Reports', 'cm_letters', 'execute', 'Download CM letter reports')
ON CONFLICT (permission_code) DO NOTHING;

-- Calendar permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('calendar:read', 'View Calendar', 'calendar', 'read', 'View maintenance calendar and schedules'),
    ('calendar:update', 'Update Calendar', 'calendar', 'update', 'Modify calendar events and schedules')
ON CONFLICT (permission_code) DO NOTHING;

-- Plant Map permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('plant:read', 'View Plant Map', 'plant', 'read', 'View plant map and tracker status'),
    ('plant:update', 'Update Tracker Status', 'plant', 'update', 'Update tracker status on plant map'),
    ('plant:approve', 'Approve Status Requests', 'plant', 'approve', 'Approve or reject tracker status change requests')
ON CONFLICT (permission_code) DO NOTHING;

-- Notifications permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('notifications:read', 'View Notifications', 'notifications', 'read', 'View notifications'),
    ('notifications:update', 'Update Notifications', 'notifications', 'update', 'Mark notifications as read'),
    ('notifications:approve', 'Approve Requests', 'notifications', 'approve', 'Approve requests via notifications')
ON CONFLICT (permission_code) DO NOTHING;

-- Reports permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('reports:read', 'View Reports', 'reports', 'read', 'View system reports'),
    ('reports:download', 'Download Reports', 'reports', 'execute', 'Download and export reports')
ON CONFLICT (permission_code) DO NOTHING;

-- System permissions
INSERT INTO permissions (permission_code, permission_name, resource, action, description) VALUES
    ('system:admin', 'System Administration', 'system', 'execute', 'Full system administration access'),
    ('system:settings', 'Manage Settings', 'system', 'update', 'Update system settings and configuration')
ON CONFLICT (permission_code) DO NOTHING;

-- Assign permissions to roles
-- System Owner: All permissions
DO $$
DECLARE
    system_owner_id UUID;
    perm_id UUID;
BEGIN
    SELECT id INTO system_owner_id FROM roles WHERE role_code = 'system_owner';
    
    FOR perm_id IN SELECT id FROM permissions
    LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (system_owner_id, perm_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Operations Administrator: Most permissions except system admin
DO $$
DECLARE
    ops_admin_id UUID;
    perm_id UUID;
BEGIN
    SELECT id INTO ops_admin_id FROM roles WHERE role_code = 'operations_admin';
    
    FOR perm_id IN 
        SELECT id FROM permissions 
        WHERE permission_code NOT IN ('system:admin')
    LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (ops_admin_id, perm_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Supervisor: Task management, approval, and viewing permissions
DO $$
DECLARE
    supervisor_id UUID;
BEGIN
    SELECT id INTO supervisor_id FROM roles WHERE role_code = 'supervisor';
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT supervisor_id, id FROM permissions
    WHERE permission_code IN (
        'tasks:create', 'tasks:read', 'tasks:update', 'tasks:assign', 'tasks:approve',
        'templates:read',
        'inventory:read', 'inventory:approve',
        'users:read',
        'cm_letters:create', 'cm_letters:read', 'cm_letters:update', 'cm_letters:download',
        'calendar:read', 'calendar:update',
        'plant:read', 'plant:approve',
        'notifications:read', 'notifications:update', 'notifications:approve',
        'reports:read', 'reports:download'
    )
    ON CONFLICT DO NOTHING;
END $$;

-- Technician: Task execution and basic viewing
DO $$
DECLARE
    technician_id UUID;
BEGIN
    SELECT id INTO technician_id FROM roles WHERE role_code = 'technician';
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT technician_id, id FROM permissions
    WHERE permission_code IN (
        'tasks:read', 'tasks:update', 'tasks:execute',
        'templates:read',
        'inventory:read',
        'cm_letters:create', 'cm_letters:read', 'cm_letters:update',
        'calendar:read',
        'plant:read', 'plant:update',
        'notifications:read', 'notifications:update'
    )
    ON CONFLICT DO NOTHING;
END $$;

-- General Worker: Limited to assigned tasks only
DO $$
DECLARE
    worker_id UUID;
BEGIN
    SELECT id INTO worker_id FROM roles WHERE role_code = 'general_worker';
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT worker_id, id FROM permissions
    WHERE permission_code IN (
        'tasks:read', 'tasks:update', 'tasks:execute',
        'templates:read',
        'calendar:read',
        'notifications:read', 'notifications:update'
    )
    ON CONFLICT DO NOTHING;
END $$;

-- Inventory Controller: Full inventory management
DO $$
DECLARE
    inv_controller_id UUID;
BEGIN
    SELECT id INTO inv_controller_id FROM roles WHERE role_code = 'inventory_controller';
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT inv_controller_id, id FROM permissions
    WHERE permission_code IN (
        'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete', 'inventory:approve',
        'tasks:read',
        'notifications:read', 'notifications:update', 'notifications:approve',
        'reports:read', 'reports:download'
    )
    ON CONFLICT DO NOTHING;
END $$;

-- Create a view for easy permission checking
CREATE OR REPLACE VIEW user_permissions AS
SELECT DISTINCT
    u.id AS user_id,
    u.username,
    p.permission_code,
    p.resource,
    p.action,
    r.role_code,
    r.role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE u.is_active = TRUE;

-- Create a function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_permission_code VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_permissions
        WHERE user_id = p_user_id
        AND permission_code = p_permission_code
    );
END;
$$ LANGUAGE plpgsql;

-- Create a function to get all user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(permission_code VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT up.permission_code
    FROM user_permissions up
    WHERE up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
