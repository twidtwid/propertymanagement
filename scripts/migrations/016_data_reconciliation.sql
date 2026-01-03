-- Migration: Data Reconciliation from Anne's Feedback
-- Date: 2026-01-02
-- Description: Add vendor specialties, fix tax lookup URLs, update pending taxes

-- ============================================================================
-- 1. ADD NEW VENDOR SPECIALTIES
-- ============================================================================
-- Add shoveling, plowing, mowing specialties for Vermont properties
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'shoveling';
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'plowing';
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'mowing';

-- ============================================================================
-- 2. UPDATE TAX LOOKUP URLs FOR PROPERTIES
-- ============================================================================

-- Vermont Main House (2055 Sunset Lake Rd, Dummerston) - NEMRC portal
UPDATE properties
SET tax_lookup_url = 'https://www.nemrc.com/npaGSSResults.aspx?town=dummerston&span=186-059-10695'
WHERE name = 'Vermont Main House';

-- Booth House (1910 Sunset Lake Rd, Dummerston)
UPDATE properties
SET tax_lookup_url = 'https://www.nemrc.com/npaGSSResults.aspx?town=dummerston&span=186-059-10098'
WHERE name = 'Booth House';

-- Vermont Guest House (2001 Sunset Lake Rd, Dummerston)
-- Note: Guest house uses same SPAN format, need to verify exact SPAN
UPDATE properties
SET tax_lookup_url = 'https://www.nemrc.com/npaGSSResults.aspx?town=dummerston&span=186-059-10693'
WHERE name = 'Vermont Guest House';

-- Vermont Land (22 Kelly Rd, Brattleboro)
UPDATE properties
SET tax_lookup_url = 'https://www.axisgis.com/BrattleboroVT/'
WHERE name = 'Vermont Land';

-- Rhode Island House (88 Williams St, Providence)
UPDATE properties
SET tax_lookup_url = 'https://cchchs.com/providenceri/'
WHERE name = 'Rhode Island House';

-- 125 Dana Avenue (Santa Clara County, CA)
UPDATE properties
SET tax_lookup_url = 'https://payments.sccgov.org/propertytax/'
WHERE name = '125 Dana Avenue';

-- Brooklyn condos (NYC)
UPDATE properties
SET tax_lookup_url = 'https://www1.nyc.gov/site/finance/taxes/property.page'
WHERE name LIKE 'Brooklyn%';

-- ============================================================================
-- 3. FIX VERMONT TAX STATUS (Aug 2025 should not be pending in Jan 2026)
-- ============================================================================
-- Mark VT taxes with due dates before today as needing review
-- For now, mark them as overdue since they're past due without confirmation

UPDATE property_taxes
SET status = 'overdue'
WHERE property_id IN (
    SELECT id FROM properties WHERE state = 'VT'
)
AND due_date < CURRENT_DATE
AND status = 'pending';

-- ============================================================================
-- 4. ADD PROPERTY TAX URL TO PROPERTY_TAXES TABLE
-- ============================================================================
-- Vermont Dummerston taxes - link to town payment portal
UPDATE property_taxes pt
SET payment_url = 'https://www.nemrc.com/npaGSSResults.aspx?town=dummerston'
FROM properties p
WHERE pt.property_id = p.id
AND p.state = 'VT'
AND pt.jurisdiction = 'Dummerston, VT';

-- Vermont Brattleboro taxes
UPDATE property_taxes pt
SET payment_url = 'https://www.axisgis.com/BrattleboroVT/'
FROM properties p
WHERE pt.property_id = p.id
AND p.state = 'VT'
AND pt.jurisdiction = 'Brattleboro, VT';

-- ============================================================================
-- 5. VERIFY/LOG CURRENT INSURANCE DATA
-- ============================================================================
-- This is just for reference - we'll verify Berkley One numbers match the portfolio
-- Select current Berkley One policies for audit
DO $$
BEGIN
    RAISE NOTICE 'Current Berkley One Policies:';
END $$;

SELECT
    carrier_name,
    policy_type,
    policy_number,
    premium_amount,
    coverage_amount,
    COALESCE(p.name, v.year || ' ' || v.make || ' ' || v.model) as asset
FROM insurance_policies ip
LEFT JOIN properties p ON ip.property_id = p.id
LEFT JOIN vehicles v ON ip.vehicle_id = v.id
WHERE carrier_name = 'Berkley One'
ORDER BY policy_type, asset;

-- ============================================================================
-- 6. ADD FRENCH PROPERTY TAX ENTRIES (Paris & Martinique)
-- ============================================================================
-- French Taxe Foncière is due annually, typically mid-October

-- Paris property tax
INSERT INTO property_taxes (
    id, property_id, tax_year, jurisdiction, installment,
    amount, due_date, payment_url, status, notes
)
SELECT
    gen_random_uuid(),
    id,
    2025,
    'Paris, France - Taxe Foncière',
    1,
    1500.00, -- Placeholder - verify from actual document
    '2025-10-15',
    'https://www.impots.gouv.fr/',
    'pending',
    'Taxe Foncière - Amount to be verified from Dropbox documents'
FROM properties
WHERE name = 'Paris Condo'
ON CONFLICT DO NOTHING;

-- Martinique property tax
INSERT INTO property_taxes (
    id, property_id, tax_year, jurisdiction, installment,
    amount, due_date, payment_url, status, notes
)
SELECT
    gen_random_uuid(),
    id,
    2025,
    'Martinique, France - Taxe Foncière',
    1,
    800.00, -- Placeholder - verify from actual document
    '2025-10-15',
    'https://www.impots.gouv.fr/',
    'pending',
    'Taxe Foncière - Amount to be verified from Dropbox "Avis d''echéance" document'
FROM properties
WHERE name = 'Martinique Condo'
ON CONFLICT DO NOTHING;

-- Update tax lookup URLs for French properties
UPDATE properties
SET tax_lookup_url = 'https://www.impots.gouv.fr/'
WHERE name IN ('Paris Condo', 'Martinique Condo')
AND tax_lookup_url IS NULL;
