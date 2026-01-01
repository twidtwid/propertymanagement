-- Update NYC property taxes with real data from NYC Finance PTS Access Portal
-- Source: https://a836-pts-access.nyc.gov/care/datalets/datalet.aspx?mode=pa_pymts_hist
-- Scraped on 2026-01-01
--
-- Both accounts show "paid in full as of January 01, 2026"
-- Tax Year = NYC Fiscal Year (July-June)
--   e.g. tax_year 2026 = FY 2025-2026 = due July 1, 2025

-- First, delete any incorrect NYC tax entries
DELETE FROM property_taxes
WHERE jurisdiction = 'NYC'
AND property_id IN (
    SELECT id FROM properties WHERE name IN ('Brooklyn Condo PH2E', 'Brooklyn Condo PH2F')
);

-- Brooklyn Condo PH2E (Block 02324, Lot 1305)
-- Payment History from NYC Finance:
--   2026: $151.91 paid Oct 1, 2025
--   2025: $130.72 paid Aug 1, 2024
--   2024: $128.90 paid Oct 1, 2023 (combined payments)
--   2023: $127.74 paid Jul 1, 2022

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2026, 'NYC', 1, 151.91, '2025-07-01', 'confirmed', '2025-10-01', '2025-10-01', '421-a abatement. Paid via NYC Finance Oct 2025. Source: a836-pts-access.nyc.gov'
FROM properties WHERE name = 'Brooklyn Condo PH2E';

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'NYC', 1, 130.72, '2024-07-01', 'confirmed', '2024-08-01', '2024-08-01', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2E';

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'NYC', 1, 128.90, '2023-07-01', 'confirmed', '2023-10-01', '2023-10-05', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2E';

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'NYC', 1, 127.74, '2022-07-01', 'confirmed', '2022-07-01', '2022-07-08', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2E';


-- Brooklyn Condo PH2F (Block 02324, Lot 1306)
-- Payment History from NYC Finance:
--   2026: $120.04 paid Jun 26, 2025
--   2025: $120.83 paid Jul 14, 2024
--   2024: $117.86 paid Jul 5, 2023
--   2023: $117.17 paid Jun 21, 2022

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2026, 'NYC', 1, 120.04, '2025-07-01', 'confirmed', '2025-06-26', '2025-07-01', '421-a abatement. Paid via NYC Finance Jun 2025. Source: a836-pts-access.nyc.gov'
FROM properties WHERE name = 'Brooklyn Condo PH2F';

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'NYC', 1, 120.83, '2024-07-01', 'confirmed', '2024-07-14', '2024-07-16', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2F';

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'NYC', 1, 117.86, '2023-07-01', 'confirmed', '2023-07-05', '2023-07-07', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2F';

INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'NYC', 1, 117.17, '2022-07-01', 'confirmed', '2022-06-21', '2022-07-01', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2F';


-- Note: Tax year 2027 (FY 2026-2027) bills will be issued in June 2026.
-- The next pending payment will appear when the Q1 2026-2027 bill is generated.

-- Verify the update
SELECT
    p.name as property,
    pt.tax_year,
    pt.amount,
    pt.due_date,
    pt.status,
    pt.payment_date,
    pt.notes
FROM property_taxes pt
JOIN properties p ON pt.property_id = p.id
WHERE p.name LIKE 'Brooklyn%'
ORDER BY p.name, pt.tax_year DESC;
