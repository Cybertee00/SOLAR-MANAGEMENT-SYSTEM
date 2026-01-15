-- Create table to store plant map structure
CREATE TABLE IF NOT EXISTS plant_map_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_data JSONB NOT NULL, -- Array of tracker objects with positions
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_plant_map_version ON plant_map_structure(version DESC);

-- Insert default empty structure (will be populated by the app)
INSERT INTO plant_map_structure (structure_data, version)
VALUES ('[]'::jsonb, 1)
ON CONFLICT DO NOTHING;
