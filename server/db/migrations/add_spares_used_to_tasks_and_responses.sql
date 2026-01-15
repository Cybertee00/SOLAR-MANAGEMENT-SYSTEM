-- Migration: Add spares_used JSONB to tasks and checklist_responses tables
-- This allows storing spares selected during PM tasks and transferring them to CM tasks

-- Add spares_used to tasks table (for CM tasks to store spares from parent PM)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS spares_used JSONB;

-- Add spares_used to checklist_responses table (to store spares selected during PM)
ALTER TABLE checklist_responses ADD COLUMN IF NOT EXISTS spares_used JSONB;
