-- Migration: Wipe all tracker status requests and related data
-- This clears all existing approvals/requests so the map can start fresh

-- Delete all notifications related to tracker status requests
DELETE FROM notifications 
WHERE type = 'tracker_status_request' 
   OR type = 'tracker_status_approved' 
   OR type = 'tracker_status_rejected'
   OR (metadata IS NOT NULL AND (metadata->>'request_id')::text IS NOT NULL);

-- Delete all tracker status requests (all statuses: pending, approved, rejected)
DELETE FROM tracker_status_requests;

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'All tracker status requests and related notifications have been deleted';
END $$;
