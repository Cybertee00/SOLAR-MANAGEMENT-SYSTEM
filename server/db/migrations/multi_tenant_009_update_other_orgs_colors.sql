-- Migration: Update Branding Colors for All Organizations Except Smart Innovations Energy
-- This migration updates primary and secondary colors for all organizations
-- except Smart Innovations Energy (which keeps its default colors)

-- Function to generate company abbreviation from company name
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

-- Function to generate company display name: "{ABBREVIATION} O&M System"
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

DO $$
DECLARE
    smart_innovations_energy_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    org_record RECORD;
    color_palettes JSONB[];
    color_index INTEGER := 0;
BEGIN
    -- Define color palettes for different organizations
    -- Each organization will get a unique color scheme
    color_palettes := ARRAY[
        '{"primary": "#FF5722", "secondary": "#FF9800"}'::jsonb,  -- Orange/Red
        '{"primary": "#4CAF50", "secondary": "#8BC34A"}'::jsonb,  -- Green
        '{"primary": "#9C27B0", "secondary": "#BA68C8"}'::jsonb,  -- Purple
        '{"primary": "#00BCD4", "secondary": "#4DD0E1"}'::jsonb,  -- Cyan
        '{"primary": "#FF9800", "secondary": "#FFC107"}'::jsonb,  -- Orange/Amber
        '{"primary": "#795548", "secondary": "#A1887F"}'::jsonb,  -- Brown
        '{"primary": "#607D8B", "secondary": "#90A4AE"}'::jsonb,  -- Blue Grey
        '{"primary": "#E91E63", "secondary": "#F06292"}'::jsonb,  -- Pink
        '{"primary": "#3F51B5", "secondary": "#5C6BC0"}'::jsonb,  -- Indigo
        '{"primary": "#009688", "secondary": "#4DB6AC"}'::jsonb   -- Teal
    ];

    -- Loop through all organizations except Smart Innovations Energy
    FOR org_record IN 
        SELECT id, name, slug 
        FROM organizations 
        WHERE id != smart_innovations_energy_id 
        AND is_active = true
        ORDER BY created_at ASC
    LOOP
        -- Get color palette for this organization (cycle through palettes)
        color_index := (color_index % array_length(color_palettes, 1)) + 1;
        
        -- Update or insert branding with new colors
        INSERT INTO organization_branding (
            organization_id,
            logo_url,
            primary_color,
            secondary_color,
            company_name_display,
            favicon_url,
            custom_domain,
            branding_config,
            updated_at
        )
        VALUES (
            org_record.id,
            NULL,  -- Keep existing logo_url if any
            color_palettes[color_index]->>'primary',
            color_palettes[color_index]->>'secondary',
            get_company_display_name(org_record.name),
            NULL,  -- Keep existing favicon_url if any
            NULL,  -- Keep existing custom_domain if any
            COALESCE(
                (SELECT branding_config FROM organization_branding WHERE organization_id = org_record.id),
                '{}'::jsonb
            ),
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
            primary_color = EXCLUDED.primary_color,
            secondary_color = EXCLUDED.secondary_color,
            company_name_display = COALESCE(
                organization_branding.company_name_display,
                EXCLUDED.company_name_display
            ),
            updated_at = CURRENT_TIMESTAMP;

        RAISE NOTICE 'Updated colors for organization: % (%) - Primary: %, Secondary: %',
            org_record.name,
            org_record.id,
            color_palettes[color_index]->>'primary',
            color_palettes[color_index]->>'secondary';
    END LOOP;

    RAISE NOTICE 'Migration completed: Updated branding colors for all organizations except Smart Innovations Energy';
END $$;

COMMENT ON TABLE organization_branding IS 'Organization branding configuration. Smart Innovations Energy uses default blue colors (#1A73E8/#4285F4). Other organizations have unique color schemes.';
