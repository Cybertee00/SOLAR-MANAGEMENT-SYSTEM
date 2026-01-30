-- Migration: Update Company Display Names to "{ABBREVIATION} O&M System" Format
-- This updates all organization branding to use the new format instead of "{Name} Management System"

-- Ensure the helper functions exist (from multi_tenant_009)
CREATE OR REPLACE FUNCTION get_company_abbreviation(company_name TEXT)
RETURNS TEXT AS $$
DECLARE
    words TEXT[];
    abbreviation TEXT := '';
    word TEXT;
BEGIN
    IF company_name IS NULL OR company_name = '' THEN
        RETURN '';
    END IF;
    
    words := string_to_array(trim(company_name), ' ');
    
    IF array_length(words, 1) = 1 THEN
        -- Single word: take first 3 characters
        RETURN upper(substring(company_name FROM 1 FOR 3));
    END IF;
    
    -- Multiple words: take first letter of each word, max 5 chars
    FOREACH word IN ARRAY words LOOP
        IF length(abbreviation) < 5 THEN
            abbreviation := abbreviation || upper(substring(word FROM 1 FOR 1));
        END IF;
    END LOOP;
    
    RETURN abbreviation;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_company_display_name(company_name TEXT)
RETURNS TEXT AS $$
DECLARE
    abbreviation TEXT;
BEGIN
    abbreviation := get_company_abbreviation(company_name);
    
    IF abbreviation = '' THEN
        RETURN 'O&M System';
    END IF;
    
    RETURN abbreviation || ' O&M System';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all organization branding to use new format
DO $$
DECLARE
    org_record RECORD;
    new_display_name TEXT;
BEGIN
    FOR org_record IN 
        SELECT o.id, o.name
        FROM organizations o
        WHERE o.is_active = true
    LOOP
        new_display_name := get_company_display_name(org_record.name);
        
        -- Update or insert branding with new display name
        INSERT INTO organization_branding (
            organization_id,
            company_name_display,
            primary_color,
            secondary_color,
            branding_config,
            updated_at
        )
        VALUES (
            org_record.id,
            new_display_name,
            COALESCE((SELECT primary_color FROM organization_branding WHERE organization_id = org_record.id), '#1A73E8'),
            COALESCE((SELECT secondary_color FROM organization_branding WHERE organization_id = org_record.id), '#4285F4'),
            COALESCE((SELECT branding_config FROM organization_branding WHERE organization_id = org_record.id), '{}'::jsonb),
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
            company_name_display = EXCLUDED.company_name_display,
            updated_at = CURRENT_TIMESTAMP;

        RAISE NOTICE 'Updated display name for organization: % -> %', org_record.name, new_display_name;
    END LOOP;

    RAISE NOTICE 'Migration completed: Updated all organization display names to "{ABBREVIATION} O&M System" format';
END $$;

COMMENT ON FUNCTION get_company_display_name IS 'Generates company display name in format "{ABBREVIATION} O&M System" from company name';
