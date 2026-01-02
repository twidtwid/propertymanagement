-- Migration 010: Create Insurance Portfolio and missing policies
-- These were skipped in 009 because the portfolio property didn't exist

BEGIN;

-- Create Insurance Portfolio property
INSERT INTO properties (id, name, address, city, state, country, property_type, status, notes)
VALUES (
    gen_random_uuid(),
    'Insurance Portfolio',
    'N/A - Multi-Asset Policies',
    'Providence',
    'RI',
    'USA',
    'other',
    'active',
    'Virtual property to hold multi-asset insurance policies (umbrella, auto fleet, fine art)'
);

-- Now insert the missing policies
DO $$
DECLARE
    v_portfolio_id UUID;
BEGIN
    SELECT id INTO v_portfolio_id FROM properties WHERE name = 'Insurance Portfolio' LIMIT 1;

    -- Auto Insurance (RI vehicles)
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

    -- Umbrella/Excess Liability
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

    -- Fine Art Insurance
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

    RAISE NOTICE 'Created 4 policies for Insurance Portfolio';
END $$;

COMMIT;

-- Verify
SELECT p.name as property, ip.carrier_name, ip.policy_type, ip.policy_number, ip.premium_amount
FROM insurance_policies ip
JOIN properties p ON ip.property_id = p.id
WHERE p.name = 'Insurance Portfolio';
