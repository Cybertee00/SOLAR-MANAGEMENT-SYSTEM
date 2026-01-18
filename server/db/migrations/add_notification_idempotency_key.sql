-- Migration: Add idempotency_key to notifications table
-- This provides a deterministic unique identifier to prevent duplicate notifications

-- Add idempotency_key column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(500);

-- Create unique index on idempotency_key (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key 
ON notifications(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency_lookup 
ON notifications(user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON COLUMN notifications.idempotency_key IS 
'Deterministic unique key based on notification content to prevent duplicates. Format: {user_id}_{type}_{identifying_fields_hash}';

COMMENT ON INDEX idx_notifications_idempotency_key IS 
'Prevents duplicate notifications with the same idempotency_key';
