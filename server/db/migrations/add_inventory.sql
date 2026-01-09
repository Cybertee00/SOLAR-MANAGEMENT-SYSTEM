-- Migration: Spares Inventory System

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT,
  item_code VARCHAR(255) UNIQUE NOT NULL,
  item_description TEXT,
  part_type TEXT,
  min_level INTEGER DEFAULT 0,
  actual_qty INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_section ON inventory_items(section);
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_code ON inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON inventory_items(actual_qty, min_level);

CREATE TABLE IF NOT EXISTS inventory_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_no VARCHAR(100) UNIQUE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_slip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id UUID REFERENCES inventory_slips(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_code_snapshot TEXT,
  item_description_snapshot TEXT,
  qty_used INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_slip_lines_slip_id ON inventory_slip_lines(slip_id);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  slip_id UUID REFERENCES inventory_slips(id) ON DELETE SET NULL,
  tx_type VARCHAR(50) NOT NULL, -- restock, use, adjust
  qty_change INTEGER NOT NULL,  -- positive or negative
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_task_id ON inventory_transactions(task_id);


