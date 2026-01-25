-- Create table to track cycles for Grass Cutting and Panel Washing
-- A cycle is completed when progress reaches 100%, then must be manually reset by authorized user

CREATE TABLE IF NOT EXISTS tracker_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL, -- 'grass_cutting' or 'panel_wash'
    cycle_number INTEGER NOT NULL, -- Current cycle number (1, 2, 3...)
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP, -- When cycle reached 100%
    reset_by UUID REFERENCES users(id), -- Who reset the cycle
    reset_at TIMESTAMP, -- When cycle was reset
    year INTEGER NOT NULL, -- For easy year-based queries
    month INTEGER NOT NULL, -- 1-12, extracted from completed_at or reset_at
    notes TEXT, -- Optional notes about the cycle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_task_cycle UNIQUE (task_type, cycle_number)
);

-- Create table to store historical snapshots of cycle progress
CREATE TABLE IF NOT EXISTS tracker_cycle_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES tracker_cycles(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    progress_percentage DECIMAL(5,2) NOT NULL, -- Progress at this snapshot
    snapshot_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    year INTEGER NOT NULL, -- Extracted from snapshot_date
    month INTEGER NOT NULL, -- 1-12, extracted from snapshot_date
    day INTEGER, -- Optional: day of month
    tracker_count INTEGER, -- Total trackers
    done_count INTEGER, -- Trackers marked as done
    halfway_count INTEGER, -- Trackers marked as halfway
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tracker_cycles_task_type ON tracker_cycles(task_type);
CREATE INDEX IF NOT EXISTS idx_tracker_cycles_task_type_year ON tracker_cycles(task_type, year);
CREATE INDEX IF NOT EXISTS idx_tracker_cycles_task_type_year_month ON tracker_cycles(task_type, year, month);
CREATE INDEX IF NOT EXISTS idx_tracker_cycles_completed_at ON tracker_cycles(completed_at);
CREATE INDEX IF NOT EXISTS idx_tracker_cycles_current ON tracker_cycles(task_type, completed_at) WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cycle_history_cycle_id ON tracker_cycle_history(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_history_task_type ON tracker_cycle_history(task_type);
CREATE INDEX IF NOT EXISTS idx_cycle_history_task_type_year_month ON tracker_cycle_history(task_type, year, month);
CREATE INDEX IF NOT EXISTS idx_cycle_history_snapshot_date ON tracker_cycle_history(snapshot_date);

-- Note: Cycles are NOT created automatically
-- Cycle 1 is created when the first tracker status is approved (task has started)
-- This ensures cycles only count when work actually begins
