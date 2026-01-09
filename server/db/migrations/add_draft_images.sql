-- Migration: Add images JSONB to draft_checklist_responses (for mobile-safe camera workflow)

ALTER TABLE draft_checklist_responses
ADD COLUMN IF NOT EXISTS images JSONB;


