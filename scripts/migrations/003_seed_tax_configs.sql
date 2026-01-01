-- Seed tax lookup configurations for all properties
-- Run after 002_tax_lookup.sql migration

-- First, ensure we have the correct provider enum values
-- (Add if not exists - this is idempotent)
DO $$
BEGIN
    -- Check if enum type exists and add values if needed
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_lookup_provider') THEN
        CREATE TYPE tax_lookup_provider AS ENUM (
            'nyc_open_data',
            'santa_clara_county',
            'city_hall_systems',
            'vermont_nemrc',
            'vermont_axisgis',
            'manual'
        );
    END IF;
END $$;

-- =============================================================================
-- NYC Brooklyn Properties (NYC Open Data API)
-- =============================================================================

-- Brooklyn Condo PH2E - 34 North 7th Street PH2E
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'nyc_open_data',
    '{"boro": "3", "block": "02324", "lot": "1305"}'::jsonb,
    TRUE
FROM properties p
WHERE p.name ILIKE '%Brooklyn%PH2E%' OR p.address ILIKE '%34 North 7th%PH2E%'
ON CONFLICT DO NOTHING;

-- Brooklyn Condo PH2F - 34 North 7th Street PH2F
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'nyc_open_data',
    '{"boro": "3", "block": "02324", "lot": "1306"}'::jsonb,
    TRUE
FROM properties p
WHERE p.name ILIKE '%Brooklyn%PH2F%' OR p.address ILIKE '%34 North 7th%PH2F%'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Santa Clara County (Playwright scraper)
-- =============================================================================

-- 125 Dana Avenue, San Jose
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'santa_clara_county',
    '{"parcel_number": "274-15-034", "address": "125 DANA AV SAN JOSE"}'::jsonb,
    TRUE
FROM properties p
WHERE p.name ILIKE '%Dana%' OR p.address ILIKE '%125 Dana%'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Providence RI (City Hall Systems - Playwright scraper)
-- =============================================================================

-- 88 Williams St, Providence
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'city_hall_systems',
    '{"municipality": "Providence", "state": "RI", "address": "88 Williams St", "parcel_number": "016-0200-0000"}'::jsonb,
    TRUE
FROM properties p
WHERE p.name ILIKE '%Rhode Island%' OR p.name ILIKE '%Williams%' OR p.address ILIKE '%88 Williams%'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Vermont Dummerston (NEMRC Database - Playwright scraper)
-- =============================================================================

-- Vermont Main House - 2055 Sunset Lake Rd
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'vermont_nemrc',
    '{"span": "186-059-10695", "town": "dummerston", "address": "2055 Sunset Lake Rd"}'::jsonb,
    TRUE
FROM properties p
WHERE p.name ILIKE '%Vermont Main%' OR p.address ILIKE '%2055 Sunset%'
ON CONFLICT DO NOTHING;

-- Booth House - 1910 Sunset Lake Rd
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'vermont_nemrc',
    '{"span": "186-059-10098", "town": "dummerston", "address": "1910 Sunset Lake Rd"}'::jsonb,
    TRUE
FROM properties p
WHERE p.name ILIKE '%Booth%' OR p.address ILIKE '%1910 Sunset%'
ON CONFLICT DO NOTHING;

-- Vermont Guest House - 2001 Sunset Lake Rd
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'vermont_nemrc',
    '{"span": "186-059-10693", "town": "dummerston", "address": "2001 Sunset Lake Rd"}'::jsonb,
    TRUE
FROM properties p
WHERE p.name ILIKE '%Vermont Guest%' OR p.address ILIKE '%2001 Sunset%'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Vermont Brattleboro (AxisGIS - Manual lookup required)
-- =============================================================================

-- 22 Kelly Rd, Brattleboro (land with house to be demolished)
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'vermont_axisgis',
    '{"span": "081-025-11151", "town": "brattleboro", "address": "22 Kelly Rd", "parcel_number": "00010009.000", "note": "AxisGIS requires manual lookup"}'::jsonb,
    FALSE  -- Disabled by default since AxisGIS is hard to automate
FROM properties p
WHERE p.name ILIKE '%Kelly%' OR p.address ILIKE '%22 Kelly%' OR p.address ILIKE '%Kelly Rd%'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Manual entries for properties without automated lookup
-- =============================================================================

-- Martinique Condo
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'manual',
    '{"note": "French territory - manual lookup required"}'::jsonb,
    FALSE
FROM properties p
WHERE p.name ILIKE '%Martinique%' OR p.city ILIKE '%Fort-de-France%'
ON CONFLICT DO NOTHING;

-- Paris Condo
INSERT INTO tax_lookup_configs (property_id, provider, lookup_params, is_active)
SELECT
    p.id,
    'manual',
    '{"note": "France - manual lookup required"}'::jsonb,
    FALSE
FROM properties p
WHERE p.name ILIKE '%Paris%' AND p.country = 'France'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Verify configurations
-- =============================================================================

-- Show what was created
SELECT
    p.name as property,
    c.provider,
    c.is_active,
    c.lookup_params
FROM tax_lookup_configs c
JOIN properties p ON c.property_id = p.id
ORDER BY p.name;
