-- Migration: Add spares_used JSONB to draft_checklist_responses

ALTER TABLE draft_checklist_responses
ADD COLUMN IF NOT EXISTS spares_used JSONB;


