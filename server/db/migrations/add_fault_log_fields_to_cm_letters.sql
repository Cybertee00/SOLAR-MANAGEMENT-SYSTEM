-- Migration: Add fault log fields to CM letters table
-- These fields are used to populate the Fault Log Excel report

-- Basic fault log fields
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS plant VARCHAR(100) DEFAULT 'Witkop';
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS fault_description VARCHAR(100); -- Preventive maintenance, Corrective maintenance, Incident, Test, Other
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS affected_plant_functionality VARCHAR(100); -- Safety, Availability/Yield, Monitoring, Security, Plant structure, Other
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS main_affected_item VARCHAR(100); -- Cabinet, Transformer, Inverter, Motor Tracker, Module, BB, CB, String, Meter, Communication device, Security Device, Other
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS production_affected VARCHAR(10); -- Yes, No

-- Affected item details (for columns I-M in Excel)
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS affected_item_line VARCHAR(50); -- Optional input
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS affected_item_cabinet INTEGER; -- 1 to 50
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS affected_item_inverter VARCHAR(20); -- 1, 2, or "1 and 2"
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS affected_item_comb_box VARCHAR(50); -- Input box
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS affected_item_bb_tracker VARCHAR(10); -- M01 to M99

-- Additional fault log fields
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS code_error VARCHAR(100); -- Optional input
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS failure_cause TEXT; -- Input box
ALTER TABLE cm_letters ADD COLUMN IF NOT EXISTS action_taken TEXT; -- Input box

-- Create index for reported_by
CREATE INDEX IF NOT EXISTS idx_cm_letters_reported_by ON cm_letters(reported_by);
