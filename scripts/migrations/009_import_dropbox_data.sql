-- Migration 009: Import data extracted from Dropbox documents
-- Run after 008_dropbox_data.sql
-- Run with: psql -h localhost -U postgres -d propertymanagement -f scripts/migrations/009_import_dropbox_data.sql

BEGIN;

-- ============================================================================
-- VEHICLES: Update with VINs and agreed values
-- ============================================================================

-- 2025 Ford Explorer ST
UPDATE vehicles SET
    vin = '1FMWK8GC1SGA89974',
    agreed_value = 63700.00
WHERE year = 2025 AND make = 'Ford' AND model ILIKE '%Explorer%';

-- 2023 Dodge Charger GT
UPDATE vehicles SET
    vin = '2C3CDXMG4PH661283',
    agreed_value = 35800.00
WHERE year = 2023 AND make = 'Dodge' AND model ILIKE '%Charger%';

-- 2023 Chevrolet Equinox Premier
UPDATE vehicles SET
    vin = '3GNAXXEG4PL113646',
    agreed_value = 30400.00
WHERE year = 2023 AND make = 'Chevrolet' AND model ILIKE '%Equinox%';

-- 2018 Chevrolet Equinox Premier
UPDATE vehicles SET
    vin = '2GNAXWEX4J6162593',
    agreed_value = 18000.00
WHERE year = 2018 AND make = 'Chevrolet' AND model ILIKE '%Equinox%';

-- 2013 Chevrolet Traverse LTZ
UPDATE vehicles SET
    vin = '1GNKVLKD4DJ103781',
    agreed_value = 11900.00
WHERE year = 2013 AND make = 'Chevrolet' AND model ILIKE '%Traverse%';

-- 2013 Chevrolet Camaro - Mark as inactive (sold to Todd)
UPDATE vehicles SET
    vin = '2G1FT1EWXD9182976',
    is_active = false,
    notes = COALESCE(notes || E'\n', '') || 'Sold to Todd Dailey for $100 on 08/01/2025. Registration cancelled 08/15/2025.'
WHERE year = 2013 AND make = 'Chevrolet' AND model ILIKE '%Camaro%';

-- ============================================================================
-- PROPERTIES: Update with HOA and ownership info
-- ============================================================================

-- Brooklyn PH2F - HOA info
UPDATE properties SET
    hoa_monthly_amount = 3331.28,
    hoa_management_company = 'AKAM Associates, Inc.'
WHERE name ILIKE '%PH2F%' OR (address ILIKE '%34 N%7th%' AND lot_number = '1306');

-- Brooklyn PH2E - HOA info (similar fee assumed)
UPDATE properties SET
    hoa_monthly_amount = 3200.00,
    hoa_management_company = 'AKAM Associates, Inc.'
WHERE name ILIKE '%PH2E%' OR (address ILIKE '%34 N%7th%' AND lot_number = '1305');

-- Paris - Ownership entity
UPDATE properties SET
    ownership_entity = 'SCI Amelia''s Way II'
WHERE name ILIKE '%Paris%' OR city ILIKE '%Paris%';

-- ============================================================================
-- VENDORS: Add new vendors from extracted documents
-- ============================================================================

-- Starkweather & Shepley (Insurance Agent)
INSERT INTO vendors (id, name, company, specialty, phone, address, notes, is_active)
VALUES (
    gen_random_uuid(),
    'Thomas DiCarlo',
    'Starkweather & Shepley Insurance Brokerage, Inc.',
    'insurance',
    '(401) 435-3600',
    'PO Box 549, Providence, RI 02901',
    'Insurance agent for all Berkley One policies. Claims: (855) 663-8551. Portal: my.berkleyone.com',
    true
) ON CONFLICT DO NOTHING;

-- AKAM Associates (HOA Management)
INSERT INTO vendors (id, name, company, specialty, phone, address, website, notes, is_active)
VALUES (
    gen_random_uuid(),
    'AKAM Associates',
    'AKAM Associates, Inc.',
    'property_management',
    '1-800-533-7901',
    '99 Park Avenue, 14th Floor, New York, NY 10016',
    'https://login.clickpay.com/akam/',
    'HOA/Condo management for Brooklyn 34 N 7th St. Building phone: 718-302-1076',
    true
) ON CONFLICT DO NOTHING;

-- Major Air (HVAC - Brooklyn)
INSERT INTO vendors (id, name, company, specialty, phone, notes, is_active)
VALUES (
    gen_random_uuid(),
    'Major Air',
    'Major Air HVAC',
    'hvac',
    NULL,
    'HVAC maintenance for Brooklyn condos. Pricing: 1 unit $14.52/mo, 2 units $29.04/mo. Unit replacement quotes: $78,048-$84,975',
    true
) ON CONFLICT DO NOTHING;

-- City & Estate Gardener (Landscaping - Providence)
INSERT INTO vendors (id, name, company, specialty, phone, email, website, address, is_active)
VALUES (
    gen_random_uuid(),
    'City & Estate Gardener',
    'City & Estate Gardener',
    'landscaping',
    '401-935-2312',
    'office@cityestategardener.com',
    'www.CityEstateGardener.com',
    'PO Box 3429, Providence, RI 02909',
    true
) ON CONFLICT DO NOTHING;

-- Groupe Gritchen Bourges (Insurance - Paris)
INSERT INTO vendors (id, name, company, specialty, phone, email, address, notes, is_active)
VALUES (
    gen_random_uuid(),
    'Groupe Gritchen Bourges',
    'Groupe Gritchen Bourges',
    'insurance',
    '02 48 65 64 04',
    'contact@gritchen-assurances.com',
    '27 Rue Charles Durand, CS70139, 18021 Bourges, France',
    'Insurance broker for Generali Iard Paris property policy. Reference: 122952',
    true
) ON CONFLICT DO NOTHING;

-- Wells Fargo (Mortgage)
INSERT INTO vendors (id, name, company, specialty, phone, email, address, notes, is_active)
VALUES (
    gen_random_uuid(),
    'Wells Fargo Home Mortgage',
    'Wells Fargo',
    'other',
    '1-866-826-4884',
    'wellsfargo@mycoverageinfo.com',
    'PO Box 100515, Florence, SC 29502-0515',
    'Mortgage lender for Brooklyn PH2F. Loan #: 0489088823',
    true
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSURANCE POLICIES: Create/Update policies with real data
-- ============================================================================

-- Get property IDs for reference
DO $$
DECLARE
    v_ri_house_id UUID;
    v_vt_main_id UUID;
    v_vt_guest_id UUID;
    v_vt_booth_id UUID;
    v_brooklyn_ph2e_id UUID;
    v_brooklyn_ph2f_id UUID;
    v_paris_id UUID;
    v_portfolio_id UUID;
BEGIN
    -- Get property IDs
    SELECT id INTO v_ri_house_id FROM properties WHERE name ILIKE '%Rhode Island%' OR (city ILIKE '%Providence%' AND address ILIKE '%88%Williams%') LIMIT 1;
    SELECT id INTO v_vt_main_id FROM properties WHERE name ILIKE '%Vermont Main%' OR (name ILIKE '%Main House%' AND state = 'VT') LIMIT 1;
    SELECT id INTO v_vt_guest_id FROM properties WHERE name ILIKE '%Guest House%' AND state = 'VT' LIMIT 1;
    SELECT id INTO v_vt_booth_id FROM properties WHERE name ILIKE '%Booth%' LIMIT 1;
    SELECT id INTO v_brooklyn_ph2e_id FROM properties WHERE name ILIKE '%PH2E%' OR lot_number = '1305' LIMIT 1;
    SELECT id INTO v_brooklyn_ph2f_id FROM properties WHERE name ILIKE '%PH2F%' OR lot_number = '1306' LIMIT 1;
    SELECT id INTO v_paris_id FROM properties WHERE name ILIKE '%Paris%' OR city ILIKE '%Paris%' LIMIT 1;
    SELECT id INTO v_portfolio_id FROM properties WHERE name = 'Insurance Portfolio' LIMIT 1;

    -- Delete existing Berkley One policies to avoid duplicates (we'll recreate with correct data)
    DELETE FROM insurance_policies WHERE carrier_name ILIKE '%Berkley%' OR carrier_name ILIKE '%Generali%';

    -- 88 Williams St (Providence RI) - Homeowners
    INSERT INTO insurance_policies (
        id, property_id, policy_type, carrier_name, policy_number,
        agent_name, agent_phone,
        premium_amount, premium_frequency, coverage_amount, deductible,
        effective_date, expiration_date, auto_renew, payment_method,
        coverage_details, notes
    ) VALUES (
        gen_random_uuid(), v_ri_house_id, 'homeowners', 'Berkley One', 'HO04383034',
        'Thomas DiCarlo', '(401) 435-3600',
        8036.00, 'annual', 4000000.00, 10000.00,
        '2025-11-01', '2026-11-01', true, 'auto_pay',
        '{"dwelling": 4000000, "other_structures": 400000, "contents": 2000000, "personal_liability": 300000, "medical_payments": 50000}'::jsonb,
        'Guaranteed Replacement Cost. Earthquake deductible: 15% / $600,000. Base premium: $6,038, Endorsements: $1,998.'
    );

    -- Vermont Main House (2055 Sunset Lake)
    IF v_vt_main_id IS NOT NULL THEN
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            coverage_details, notes
        ) VALUES (
            gen_random_uuid(), v_vt_main_id, 'homeowners', 'Berkley One', 'HO04383038',
            'Thomas DiCarlo', '(401) 435-3600',
            5527.00, 'annual', 2682000.00, 10000.00,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '{"dwelling": 2682000, "contents": 1072800, "personal_liability": 300000}'::jsonb,
            '2055 Sunset Lake Rd, Dummerston, VT'
        );
    END IF;

    -- Vermont Guest House (1910 Sunset Lake)
    IF v_vt_guest_id IS NOT NULL THEN
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            coverage_details, notes
        ) VALUES (
            gen_random_uuid(), v_vt_guest_id, 'homeowners', 'Berkley One', 'HO04383039',
            'Thomas DiCarlo', '(401) 435-3600',
            2057.00, 'annual', 814000.00, 10000.00,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '{"dwelling": 814000, "contents": 407000, "personal_liability": 300000}'::jsonb,
            '1910 Sunset Lake Rd, Dummerston, VT'
        );
    END IF;

    -- Vermont Booth House
    IF v_vt_booth_id IS NOT NULL THEN
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            coverage_details, notes
        ) VALUES (
            gen_random_uuid(), v_vt_booth_id, 'homeowners', 'Berkley One', 'HO04383040',
            'Thomas DiCarlo', '(401) 435-3600',
            3333.00, 'annual', 854000.00, 5000.00,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '{"dwelling": 854000, "other_structures": 85400, "contents": 341600, "personal_liability": 300000}'::jsonb,
            'Booth House, Dummerston, VT'
        );
    END IF;

    -- Brooklyn PH2E - Condo
    IF v_brooklyn_ph2e_id IS NOT NULL THEN
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            coverage_details, notes
        ) VALUES (
            gen_random_uuid(), v_brooklyn_ph2e_id, 'homeowners', 'Berkley One', 'HO04383041',
            'Thomas DiCarlo', '(401) 435-3600',
            6927.00, 'annual', 1700000.00, 10000.00,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '{"contents": 1700000, "improvements": 221000, "personal_liability": 300000}'::jsonb,
            'Condo policy for 34 N 7th St PH2E, Brooklyn. Edge 11211 Condominium.'
        );
    END IF;

    -- Brooklyn PH2F - Condo (with mortgage)
    IF v_brooklyn_ph2f_id IS NOT NULL THEN
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            coverage_details, notes
        ) VALUES (
            gen_random_uuid(), v_brooklyn_ph2f_id, 'homeowners', 'Berkley One', 'HO04383042',
            'Thomas DiCarlo', '(401) 435-3600',
            7081.00, 'annual', 1700000.00, 10000.00,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '{"contents": 1700000, "improvements": 221000, "personal_liability": 300000}'::jsonb,
            'Condo policy for 34 N 7th St PH2F, Brooklyn. Edge 11211 Condominium. Mortgagee: Wells Fargo, Loan #0489088823'
        );
    END IF;

    -- Paris - Generali
    IF v_paris_id IS NOT NULL THEN
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone, agent_email,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            coverage_details, notes
        ) VALUES (
            gen_random_uuid(), v_paris_id, 'homeowners', 'Generali Iard', 'AU 466 050',
            'Groupe Gritchen Bourges', '02 48 65 64 04', 'contact@gritchen-assurances.com',
            294.88, 'annual', 30000.00, NULL,
            '2025-03-17', '2026-03-16', true, 'auto_pay',
            '{"contents": 30000}'::jsonb,
            'French homeowners policy (L''Habitation Generali). Currency: EUR. Coverage includes fire, water damage, theft, liability. Owned by SCI Amelia''s Way II.'
        );
    END IF;

    -- Auto Insurance (RI vehicles) - Link to Portfolio
    IF v_portfolio_id IS NOT NULL THEN
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            coverage_details, notes
        ) VALUES (
            gen_random_uuid(), v_portfolio_id, 'auto', 'Berkley One', 'PA04383042',
            'Thomas DiCarlo', '(401) 435-3600',
            10308.00, 'annual', 500000.00, 1000.00,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '{"bodily_injury": 500000, "property_damage": 500000, "collision": 1000, "comprehensive": 2000}'::jsonb,
            'Auto policy covering all RI-registered vehicles. $500K combined single limit. Collision deductible: $1,000, Comprehensive: $2,000'
        );

        -- Umbrella/Excess Liability - Berkley One
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            notes
        ) VALUES (
            gen_random_uuid(), v_portfolio_id, 'umbrella', 'Berkley One', 'EL04383043',
            'Thomas DiCarlo', '(401) 435-3600',
            12623.00, 'annual', 30000000.00, NULL,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '$30,000,000 umbrella liability policy covering all properties and vehicles.'
        );

        -- Hudson Excess (Secondary Umbrella)
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            notes
        ) VALUES (
            gen_random_uuid(), v_portfolio_id, 'umbrella', 'Hudson Excess', NULL,
            'Thomas DiCarlo', '(401) 435-3600',
            2608.52, 'annual', 5000000.00, NULL,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            '$5,000,000 excess liability (secondary umbrella). NOTE: Amelia Spalter excluded from coverage due to driving incidents.'
        );

        -- Fine Art Insurance (Blanket)
        INSERT INTO insurance_policies (
            id, property_id, policy_type, carrier_name, policy_number,
            agent_name, agent_phone,
            premium_amount, premium_frequency, coverage_amount, deductible,
            effective_date, expiration_date, auto_renew, payment_method,
            notes
        ) VALUES (
            gen_random_uuid(), v_portfolio_id, 'other', 'Berkley One', 'VA04383044',
            'Thomas DiCarlo', '(401) 435-3600',
            13624.00, 'annual', 10000000.00, NULL,
            '2025-11-01', '2026-11-01', true, 'auto_pay',
            'Fine Art & Valuable Articles blanket policy. Coverage: ~$10M total across properties. Includes jewelry ($48,200 scheduled), miscellaneous ($178,385 scheduled).'
        );
    END IF;

END $$;

COMMIT;
