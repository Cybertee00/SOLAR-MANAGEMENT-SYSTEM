-- Migration: Multi-Tenant Step 2 - Create Tenant Configuration Tables
-- This creates tables for tenant-specific settings, features, and branding

-- Organization Settings Table (Key-Value pairs for flexible configuration)
CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    setting_key VARCHAR(100) NOT NULL, -- e.g., 'workflow_type', 'field_labels', 'default_language'
    setting_value JSONB NOT NULL, -- Flexible JSONB for any setting value
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, setting_key)
);

-- Organization Features Table (Feature flags per tenant)
CREATE TABLE IF NOT EXISTS organization_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    feature_code VARCHAR(100) NOT NULL, -- e.g., 'advanced_reporting', 'api_access', 'white_labeling'
    is_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb, -- Feature-specific configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, feature_code)
);

-- Organization Branding Table (White-labeling support)
CREATE TABLE IF NOT EXISTS organization_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    primary_color VARCHAR(50), -- Hex color code
    secondary_color VARCHAR(50), -- Hex color code
    company_name_display VARCHAR(255), -- Display name (can differ from legal name)
    favicon_url VARCHAR(500),
    custom_domain VARCHAR(255), -- Optional custom domain
    branding_config JSONB DEFAULT '{}'::jsonb, -- Additional branding settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organization_settings_org_id ON organization_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_settings_key ON organization_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_organization_features_org_id ON organization_features(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_features_code ON organization_features(feature_code);
CREATE INDEX IF NOT EXISTS idx_organization_features_enabled ON organization_features(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_organization_branding_org_id ON organization_branding(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_branding_domain ON organization_branding(custom_domain) WHERE custom_domain IS NOT NULL;

-- Add comments
COMMENT ON TABLE organization_settings IS 'Key-value settings for each organization (workflows, labels, etc.)';
COMMENT ON TABLE organization_features IS 'Feature flags and configurations per organization';
COMMENT ON TABLE organization_branding IS 'White-labeling and branding configuration per organization';
