-- Seed property tax payments for all properties
-- These will show on the calendar and payments page

-- =============================================================================
-- Providence RI - 88 Williams St (2025 Tax Year, Quarterly)
-- =============================================================================

-- Get the property ID for Rhode Island House
DO $$
DECLARE
    ri_property_id UUID;
BEGIN
    SELECT id INTO ri_property_id FROM properties
    WHERE name ILIKE '%Rhode Island%' OR address ILIKE '%88 Williams%'
    LIMIT 1;

    IF ri_property_id IS NOT NULL THEN
        -- Q1 2025
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (ri_property_id, 2025, 'Providence, RI', 1, 2327.67, '2025-07-24', 'pending', 'Quarterly payment - City Hall Systems')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = 2327.67, due_date = '2025-07-24';

        -- Q2 2025
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (ri_property_id, 2025, 'Providence, RI', 2, 2327.67, '2025-10-24', 'pending', 'Quarterly payment - City Hall Systems')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = 2327.67, due_date = '2025-10-24';

        -- Q3 2025 (due in 2026)
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (ri_property_id, 2025, 'Providence, RI', 3, 2327.67, '2026-01-24', 'pending', 'Quarterly payment - City Hall Systems')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = 2327.67, due_date = '2026-01-24';

        -- Q4 2025 (due in 2026)
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (ri_property_id, 2025, 'Providence, RI', 4, 2327.67, '2026-04-24', 'pending', 'Quarterly payment - City Hall Systems')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = 2327.67, due_date = '2026-04-24';

        RAISE NOTICE 'Providence RI taxes inserted for property %', ri_property_id;
    END IF;
END $$;

-- =============================================================================
-- NYC Brooklyn - PH2E and PH2F
-- NOTE: NYC taxes should be entered manually by the user via the UI.
-- These condos have tax abatements so amounts are property-specific.
-- Block 02324, Lot 1305 (PH2E) and Lot 1306 (PH2F)
-- =============================================================================

-- =============================================================================
-- Santa Clara County - 125 Dana Ave (Semi-annual)
-- =============================================================================

DO $$
DECLARE
    scc_property_id UUID;
BEGIN
    SELECT id INTO scc_property_id FROM properties
    WHERE name ILIKE '%Dana%' OR address ILIKE '%125 Dana%'
    LIMIT 1;

    IF scc_property_id IS NOT NULL THEN
        -- 2025/2026 Tax Year
        -- Installment 1
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (scc_property_id, 2026, 'Santa Clara County, CA', 1, 5891.77, '2025-12-10', 'pending', 'First installment - SCC Tax Collector')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = 5891.77, due_date = '2025-12-10';

        -- Installment 2
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (scc_property_id, 2026, 'Santa Clara County, CA', 2, 5891.77, '2026-04-10', 'pending', 'Second installment - SCC Tax Collector')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = 5891.77, due_date = '2026-04-10';

        RAISE NOTICE 'Santa Clara County taxes inserted for property %', scc_property_id;
    END IF;
END $$;

-- =============================================================================
-- Vermont - Dummerston Properties (Semi-annual: Aug 15, Feb 15)
-- =============================================================================

-- Vermont Main House - 2055 Sunset Lake Rd
DO $$
DECLARE
    vt_main_property_id UUID;
    -- Estimated tax based on $870,300 assessment at ~$2.00/$100
    estimated_annual_tax DECIMAL := 17406.00;
BEGIN
    SELECT id INTO vt_main_property_id FROM properties
    WHERE name ILIKE '%Vermont Main%' OR address ILIKE '%2055 Sunset%'
    LIMIT 1;

    IF vt_main_property_id IS NOT NULL THEN
        -- 2025 Tax Year
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (vt_main_property_id, 2025, 'Dummerston, VT', 1, estimated_annual_tax / 2, '2025-08-15', 'pending', 'First installment - Town of Dummerston')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2025-08-15';

        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (vt_main_property_id, 2025, 'Dummerston, VT', 2, estimated_annual_tax / 2, '2026-02-15', 'pending', 'Second installment - Town of Dummerston')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2026-02-15';

        RAISE NOTICE 'VT Main House taxes inserted for property %', vt_main_property_id;
    END IF;
END $$;

-- Booth House - 1910 Sunset Lake Rd
DO $$
DECLARE
    booth_property_id UUID;
    -- Estimated tax based on $363,800 assessment
    estimated_annual_tax DECIMAL := 7276.00;
BEGIN
    SELECT id INTO booth_property_id FROM properties
    WHERE name ILIKE '%Booth%' OR address ILIKE '%1910 Sunset%'
    LIMIT 1;

    IF booth_property_id IS NOT NULL THEN
        -- 2025 Tax Year
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (booth_property_id, 2025, 'Dummerston, VT', 1, estimated_annual_tax / 2, '2025-08-15', 'pending', 'First installment - Town of Dummerston')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2025-08-15';

        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (booth_property_id, 2025, 'Dummerston, VT', 2, estimated_annual_tax / 2, '2026-02-15', 'pending', 'Second installment - Town of Dummerston')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2026-02-15';

        RAISE NOTICE 'Booth House taxes inserted for property %', booth_property_id;
    END IF;
END $$;

-- Vermont Guest House - 2001 Sunset Lake Rd
DO $$
DECLARE
    guest_property_id UUID;
    -- Estimated tax based on $413,000 assessment
    estimated_annual_tax DECIMAL := 8260.00;
BEGIN
    SELECT id INTO guest_property_id FROM properties
    WHERE name ILIKE '%Vermont Guest%' OR address ILIKE '%2001 Sunset%'
    LIMIT 1;

    IF guest_property_id IS NOT NULL THEN
        -- 2025 Tax Year
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (guest_property_id, 2025, 'Dummerston, VT', 1, estimated_annual_tax / 2, '2025-08-15', 'pending', 'First installment - Town of Dummerston')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2025-08-15';

        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (guest_property_id, 2025, 'Dummerston, VT', 2, estimated_annual_tax / 2, '2026-02-15', 'pending', 'Second installment - Town of Dummerston')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2026-02-15';

        RAISE NOTICE 'Guest House taxes inserted for property %', guest_property_id;
    END IF;
END $$;

-- =============================================================================
-- Vermont - Brattleboro (22 Kelly Rd)
-- =============================================================================

DO $$
DECLARE
    kelly_property_id UUID;
    -- Based on $211,130 assessment
    estimated_annual_tax DECIMAL := 4222.60;
BEGIN
    SELECT id INTO kelly_property_id FROM properties
    WHERE name ILIKE '%Kelly%' OR address ILIKE '%22 Kelly%'
    LIMIT 1;

    IF kelly_property_id IS NOT NULL THEN
        -- 2025 Tax Year
        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (kelly_property_id, 2025, 'Brattleboro, VT', 1, estimated_annual_tax / 2, '2025-08-15', 'pending', 'First installment - Town of Brattleboro')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2025-08-15';

        INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
        VALUES (kelly_property_id, 2025, 'Brattleboro, VT', 2, estimated_annual_tax / 2, '2026-02-15', 'pending', 'Second installment - Town of Brattleboro')
        ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET amount = estimated_annual_tax / 2, due_date = '2026-02-15';

        RAISE NOTICE 'Kelly Rd taxes inserted for property %', kelly_property_id;
    END IF;
END $$;

-- =============================================================================
-- Verify all property taxes
-- =============================================================================

SELECT
    p.name as property,
    pt.jurisdiction,
    pt.tax_year,
    pt.installment,
    pt.amount,
    pt.due_date,
    pt.status
FROM property_taxes pt
JOIN properties p ON pt.property_id = p.id
ORDER BY pt.due_date, p.name;
