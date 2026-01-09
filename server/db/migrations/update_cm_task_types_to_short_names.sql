-- Migration: Update task types to use short names
-- Change "Planned CM" to "PCM" and "Unplanned CM" to "UCM"

-- Update existing tasks
UPDATE tasks 
SET task_type = 'PCM' 
WHERE task_type = 'Planned CM';

UPDATE tasks 
SET task_type = 'UCM' 
WHERE task_type = 'Unplanned CM';

-- Update checklist templates
UPDATE checklist_templates 
SET task_type = 'PCM' 
WHERE task_type = 'Planned CM';

UPDATE checklist_templates 
SET task_type = 'UCM' 
WHERE task_type = 'Unplanned CM';
