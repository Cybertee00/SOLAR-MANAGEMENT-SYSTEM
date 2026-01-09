-- Migration: Add metadata fields to tasks and checklist responses
-- Add maintenance team, inspector, and approver fields

-- Add metadata fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS maintenance_team TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS inspected_by TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS inspection_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS inspection_time TIME;

-- Add metadata to checklist responses
ALTER TABLE checklist_responses ADD COLUMN IF NOT EXISTS maintenance_team TEXT;
ALTER TABLE checklist_responses ADD COLUMN IF NOT EXISTS inspected_by TEXT;
ALTER TABLE checklist_responses ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Create table for failed item images
CREATE TABLE IF NOT EXISTS failed_item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    checklist_response_id UUID REFERENCES checklist_responses(id) ON DELETE CASCADE,
    item_id VARCHAR(100) NOT NULL, -- References the checklist item ID
    section_id VARCHAR(100) NOT NULL, -- References the section ID
    image_path VARCHAR(500) NOT NULL, -- Path to stored image
    image_filename VARCHAR(255) NOT NULL, -- Original filename
    comment TEXT, -- Comment about the failure
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for failed item images
CREATE INDEX IF NOT EXISTS idx_failed_item_images_task_id ON failed_item_images(task_id);
CREATE INDEX IF NOT EXISTS idx_failed_item_images_response_id ON failed_item_images(checklist_response_id);

-- Update CM letters to store images
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS images JSONB; -- Array of image paths
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS failure_comments JSONB; -- Comments for each failed item

