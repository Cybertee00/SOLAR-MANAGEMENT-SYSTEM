-- Migration: Add Default Configuration Entries for Organizations
-- This migration adds default configuration entries for dashboard, notifications, and reports
-- to existing organizations in the organization_settings table

DO $$
DECLARE
    org_record RECORD;
    dashboard_config JSONB;
    notifications_config JSONB;
    reports_config JSONB;
    tasks_config JSONB;
    inventory_config JSONB;
    calendar_config JSONB;
    security_config JSONB;
BEGIN
    -- Default dashboard configuration
    dashboard_config := '{
        "layout": "grid",
        "visible_cards": ["tasks", "assets", "inventory", "calendar", "plant"],
        "kpi_visibility": {
            "pending_tasks": true,
            "completed_tasks": true,
            "open_cm_letters": true,
            "in_progress_tasks": true
        },
        "refresh_interval": 30,
        "default_view": "overview"
    }'::jsonb;

    -- Default notifications configuration
    notifications_config := '{
        "email_enabled": true,
        "sms_enabled": false,
        "channels": ["in_app", "email"],
        "rules": [
            {
                "event": "task_assigned",
                "channels": ["in_app", "email"],
                "recipients": ["assignee", "supervisor"],
                "template": "default"
            },
            {
                "event": "task_completed",
                "channels": ["in_app"],
                "recipients": ["assignee", "supervisor"],
                "template": "default"
            },
            {
                "event": "cm_letter_generated",
                "channels": ["in_app", "email"],
                "recipients": ["admin", "supervisor"],
                "template": "cm_letter"
            }
        ],
        "quiet_hours": {
            "enabled": false,
            "start": "22:00",
            "end": "07:00",
            "timezone": "UTC"
        }
    }'::jsonb;

    -- Default reports configuration
    reports_config := '{
        "templates": {
            "pm_report": {
                "enabled": true,
                "custom_fields": ["location", "technician", "asset_type"],
                "format": "pdf",
                "include_charts": true,
                "include_images": true
            },
            "cm_report": {
                "enabled": true,
                "custom_fields": ["failure_reason", "corrective_action"],
                "format": "pdf",
                "include_charts": true
            },
            "inventory_report": {
                "enabled": true,
                "custom_fields": ["location", "category"],
                "format": "excel",
                "include_low_stock": true
            }
        },
        "default_format": "pdf",
        "auto_generate": {
            "pm_monthly": false,
            "cm_weekly": false
        },
        "delivery": {
            "email": true,
            "storage": "cloud",
            "retention_days": 90
        }
    }'::jsonb;

    -- Default tasks configuration
    tasks_config := '{
        "default_priority": "medium",
        "auto_assign": false,
        "require_photos": true,
        "require_checklist": true,
        "allow_early_completion": true,
        "workflow": {
            "pm_to_cm_auto_generate": true,
            "cm_letter_auto_generate": true,
            "approval_required": false
        },
        "reminders": {
            "enabled": true,
            "days_before_due": [3, 1],
            "channels": ["in_app", "email"]
        }
    }'::jsonb;

    -- Default inventory configuration
    inventory_config := '{
        "low_stock_threshold": 10,
        "auto_reorder": false,
        "track_consumption": true,
        "require_approval": false,
        "categories": ["spare_parts", "consumables", "tools"],
        "units": {
            "default": "pieces",
            "allowed": ["pieces", "liters", "kilograms", "meters"]
        }
    }'::jsonb;

    -- Default calendar configuration
    calendar_config := '{
        "default_view": "month",
        "working_hours": {
            "start": "08:00",
            "end": "17:00",
            "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
        },
        "holidays": [],
        "timezone": "UTC",
        "show_weekends": true
    }'::jsonb;

    -- Default security configuration
    security_config := '{
        "password_policy": {
            "min_length": 8,
            "require_uppercase": true,
            "require_lowercase": true,
            "require_numbers": true,
            "require_special": false,
            "expiry_days": 90
        },
        "session_timeout": 3600,
        "two_factor_enabled": false,
        "ip_whitelist": [],
        "audit_log_retention_days": 365
    }'::jsonb;

    -- Loop through all organizations and add default configurations
    FOR org_record IN SELECT id FROM organizations WHERE is_active = true
    LOOP
        -- Insert dashboard configuration (if not exists)
        INSERT INTO organization_settings (organization_id, setting_key, setting_value, description, created_at, updated_at)
        SELECT 
            org_record.id,
            'dashboard',
            dashboard_config,
            'Dashboard layout and visibility preferences',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_settings 
            WHERE organization_id = org_record.id AND setting_key = 'dashboard'
        );

        -- Insert notifications configuration (if not exists)
        INSERT INTO organization_settings (organization_id, setting_key, setting_value, description, created_at, updated_at)
        SELECT 
            org_record.id,
            'notifications',
            notifications_config,
            'Notification preferences and rules',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_settings 
            WHERE organization_id = org_record.id AND setting_key = 'notifications'
        );

        -- Insert reports configuration (if not exists)
        INSERT INTO organization_settings (organization_id, setting_key, setting_value, description, created_at, updated_at)
        SELECT 
            org_record.id,
            'reports',
            reports_config,
            'Report template and generation preferences',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_settings 
            WHERE organization_id = org_record.id AND setting_key = 'reports'
        );

        -- Insert tasks configuration (if not exists)
        INSERT INTO organization_settings (organization_id, setting_key, setting_value, description, created_at, updated_at)
        SELECT 
            org_record.id,
            'tasks',
            tasks_config,
            'Task management preferences and workflow settings',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_settings 
            WHERE organization_id = org_record.id AND setting_key = 'tasks'
        );

        -- Insert inventory configuration (if not exists)
        INSERT INTO organization_settings (organization_id, setting_key, setting_value, description, created_at, updated_at)
        SELECT 
            org_record.id,
            'inventory',
            inventory_config,
            'Inventory management preferences',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_settings 
            WHERE organization_id = org_record.id AND setting_key = 'inventory'
        );

        -- Insert calendar configuration (if not exists)
        INSERT INTO organization_settings (organization_id, setting_key, setting_value, description, created_at, updated_at)
        SELECT 
            org_record.id,
            'calendar',
            calendar_config,
            'Calendar and scheduling preferences',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_settings 
            WHERE organization_id = org_record.id AND setting_key = 'calendar'
        );

        -- Insert security configuration (if not exists)
        INSERT INTO organization_settings (organization_id, setting_key, setting_value, description, created_at, updated_at)
        SELECT 
            org_record.id,
            'security',
            security_config,
            'Security and password policy settings',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_settings 
            WHERE organization_id = org_record.id AND setting_key = 'security'
        );

        RAISE NOTICE 'Added default configurations for organization: %', org_record.id;
    END LOOP;

    -- Also ensure default features are enabled for all organizations
    FOR org_record IN SELECT id FROM organizations WHERE is_active = true
    LOOP
        -- Enable standard features (if not already set)
        INSERT INTO organization_features (organization_id, feature_code, is_enabled, config, created_at, updated_at)
        SELECT 
            org_record.id,
            feature_code,
            true,
            '{}'::jsonb,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM (VALUES 
            ('tasks'),
            ('inventory'),
            ('calendar'),
            ('plant'),
            ('reports'),
            ('cm_letters'),
            ('checklist_templates'),
            ('notifications'),
            ('offline_sync'),
            ('multi_user'),
            ('audit_trail')
        ) AS features(feature_code)
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_features 
            WHERE organization_id = org_record.id AND organization_features.feature_code = features.feature_code
        );

        RAISE NOTICE 'Added default features for organization: %', org_record.id;
    END LOOP;

    RAISE NOTICE 'Migration completed: Default configurations added to all active organizations';
END $$;

COMMENT ON TABLE organization_settings IS 'Per-organization configuration settings. Use JSONB for flexible schema evolution.';
COMMENT ON TABLE organization_features IS 'Feature flags and module enablement per organization. Controls which features are available.';
