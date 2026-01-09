-- Migration: Add super_admin role, spare requests system, and task unlock functionality

-- Update users table to support super_admin role
-- Note: This is a VARCHAR field, so we just need to ensure the application accepts 'super_admin'
-- No schema change needed, but we'll add a comment
COMMENT ON COLUMN users.role IS 'Role: technician, supervisor, admin, super_admin';

-- Add is_locked field to tasks table (for unlocking completed tasks)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- Create spare_requests table
CREATE TABLE IF NOT EXISTS spare_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, fulfilled
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    fulfilled_at TIMESTAMP,
    requested_items JSONB NOT NULL, -- Array of {item_id, quantity, reason}
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for spare_requests
CREATE INDEX IF NOT EXISTS idx_spare_requests_task_id ON spare_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_spare_requests_requested_by ON spare_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_spare_requests_status ON spare_requests(status);
CREATE INDEX IF NOT EXISTS idx_tasks_is_locked ON tasks(is_locked);

-- Create table for spare request items (detailed breakdown)
CREATE TABLE IF NOT EXISTS spare_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spare_request_id UUID REFERENCES spare_requests(id) ON DELETE CASCADE NOT NULL,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL, -- References inventory_items.id (UUID)
    item_code VARCHAR(255), -- Store item_code for reference (denormalized)
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    approved_quantity INTEGER, -- May be less than requested
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spare_request_items_request_id ON spare_request_items(spare_request_id);
CREATE INDEX IF NOT EXISTS idx_spare_request_items_inventory_item ON spare_request_items(inventory_item_id);
