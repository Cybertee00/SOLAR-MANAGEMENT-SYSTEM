-- Migration: Add unique constraint to prevent duplicate notifications
-- This prevents the same user from receiving duplicate notifications for the same request

-- Drop existing index if it exists (to recreate with better constraint)
DROP INDEX IF EXISTS idx_notifications_user_type_request;

-- Add unique constraint on (user_id, type, metadata->>'request_id')
-- This ensures that for tracker status requests, each user only gets one notification per request
-- The constraint only applies when request_id is not null (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_type_request 
ON notifications(user_id, type, (metadata->>'request_id'))
WHERE metadata->>'request_id' IS NOT NULL;

-- Add index for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_request_id 
ON notifications((metadata->>'request_id'))
WHERE metadata->>'request_id' IS NOT NULL;

-- Add index for faster lookups when marking notifications as read by request_id
CREATE INDEX IF NOT EXISTS idx_notifications_type_request_read 
ON notifications(type, (metadata->>'request_id'), user_id, is_read)
WHERE metadata->>'request_id' IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_notifications_user_type_request IS 
'Prevents duplicate notifications for the same user, type, and request_id (e.g., tracker status requests)';
