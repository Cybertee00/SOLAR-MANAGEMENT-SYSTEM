-- Add site_map_name field to organization_branding table
-- This allows each organization to have a custom site map name
-- Default: "Site Map" (for companies without a specific name)

ALTER TABLE organization_branding 
ADD COLUMN IF NOT EXISTS site_map_name VARCHAR(255) DEFAULT 'Site Map';

-- Update Smart Innovations Energy to have "Witkop Solar Farm Site Map"
UPDATE organization_branding 
SET site_map_name = 'Witkop Solar Farm Site Map'
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'smart-innovations-energy' LIMIT 1)
AND site_map_name IS NULL;

-- Add comment
COMMENT ON COLUMN organization_branding.site_map_name IS 'Custom name for the plant/site map (e.g., "Witkop Solar Farm Site Map"). Defaults to "Site Map" if not specified.';
