-- Sync 2025 property taxes and property updates from local to production
-- Created: 2025-01-03
--
-- This script:
-- 1. Updates 5 properties with parcel IDs, SPAN numbers, and detailed info
-- 2. Inserts 12 new tax records for 2025

BEGIN;

-- ============================================
-- PROPERTY UPDATES
-- ============================================

-- 22 Kelly Rd (Brattleboro, VT)
UPDATE properties SET
  parcel_id = '00010009.000',
  notes = E'Has existing house - taxed and insured. Planned for demolition.\nBrattleboro VT. SPAN: 081-025-11151. Property includes 51 acres.\nSCL Code: 025'
WHERE id = 'c73f533a-9aa1-4eb2-9630-b93d210b19f3';

-- Vermont Main House (2055 Sunset Lake Rd, Dummerston)
UPDATE properties SET
  parcel_id = '000453',
  square_feet = 3032,
  current_value = 870300,
  purchase_date = '2010-08-30',
  purchase_price = 530000,
  notes = E'Contemporary design, 1.5 story finished, built 2000. 6 rooms, 3 bedrooms, 2 full baths, 1 kitchen. 3 fireplaces. Condition: Average.\nBuilding: 3,032 SF. Basement: 2,048 SF (concrete). Porch: 1,214 SF. Garage/Shed: 600 SF.\nLand: 48.4 acres ($219,200). Dwelling: $609,600. Site Improvements: $40,000. Outbuildings: $1,500. Total: $870,300.\nHomestead: $622,100. Housesite: $461,400.\nSale: Book 105, Page 20, Date 2010-08-30, Price $530,000.\nSCL Code: 059.\nNote: Parcel includes second building (Guest House - log cabin, 2,560 SF, built 2005) which is tracked separately.'
WHERE id = '681ecd18-5569-42b2-bd13-4dd38ff7762c';

-- Vermont Guest House (2001 Sunset Lake Rd, Dummerston)
UPDATE properties SET
  span_number = '186-059-10693',
  parcel_id = '000454',
  square_feet = 2278,
  current_value = 413000,
  notes = E'Guest accommodations\nLog cabin design, 1.5 story finished. 8 rooms, 4 bedrooms, 2 full baths, 1 half bath, 1 kitchen. 1 fireplace. 648 SF porch. 864 SF basement (concrete). Condition: Avg/Good.\nLand: 4.4 acres ($76,800). Dwelling: $304,000. Site Improvements: $25,500. Outbuildings: $6,700. Total: $413,000.\nHomestead: $413,000. Housesite: $402,300.\nSale: Book 106, Page 31-32, Date 2011-07-19.'
WHERE id = '64482fc4-6d7f-4c9c-a55a-75ca208767fe';

-- Booth House (1910 Sunset Lake Rd, Dummerston)
UPDATE properties SET
  parcel_id = '000446',
  notes = E'Named after previous owners.\nDummerston VT tax rate: 1.76% effective ($17.60/$1000). SPAN: 186-059-10098.\nSCL Code: 059'
WHERE id = 'd4a964c3-f090-453f-ae7a-7465b61f3b52';

-- Rhode Island House (88 Williams St, Providence)
UPDATE properties SET
  parcel_id = '016-0200-0000',
  square_feet = 3517,
  current_value = 1197700,
  notes = E'Colonial built 1824. 3,517 SF living area. 3 full bath, 1 half bath. 1 fireplace. Forced warm air heat.\nLand: 6,080 SF ($554,000). Building: $643,700. Total: $1,197,700.\nParcel: Map/Lot 16-200, Account 10845, User Account 01602000000.\nOutbuildings: Wood frame garage (360 SF, 1900), 2 patios, shed.\nElderly OO Exemption: $89,286 ($750 credit).\nMonitored alarm system, Hikvision cameras. Justin (Parker Construction) oversees.'
WHERE id = 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2';

-- ============================================
-- TAX RECORDS - 22 Kelly Rd (Brattleboro, VT)
-- ============================================

INSERT INTO property_taxes (id, property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
VALUES
  ('ce660954-5691-4bc2-aba8-74165c4dc434', 'c73f533a-9aa1-4eb2-9630-b93d210b19f3', 2025, 'Brattleboro, VT', 1, 1761.56, '2025-08-15', 'pending', 'Municipal + Education Tax (Total $7,046.24 for year)'),
  ('2b50ba20-0b96-4cec-894e-377fc1df0ed9', 'c73f533a-9aa1-4eb2-9630-b93d210b19f3', 2025, 'Brattleboro, VT', 2, 1761.56, '2025-11-17', 'pending', 'Municipal + Education Tax'),
  ('1c92ad49-4265-4a9b-8ff9-3acda811b245', 'c73f533a-9aa1-4eb2-9630-b93d210b19f3', 2025, 'Brattleboro, VT', 3, 1761.56, '2026-02-17', 'pending', 'Municipal + Education Tax'),
  ('4f7b4d19-ae8e-455e-a2ad-2098488d1e5c', 'c73f533a-9aa1-4eb2-9630-b93d210b19f3', 2025, 'Brattleboro, VT', 4, 1761.56, '2026-05-15', 'pending', 'Municipal + Education Tax')
ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET
  amount = EXCLUDED.amount,
  due_date = EXCLUDED.due_date,
  notes = EXCLUDED.notes;

-- ============================================
-- TAX RECORDS - Vermont Main House (Dummerston, VT)
-- ============================================

INSERT INTO property_taxes (id, property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
VALUES
  ('749aeecf-2258-4595-9f3c-bfaabd29e710', '681ecd18-5569-42b2-bd13-4dd38ff7762c', 2025, 'Dummerston, VT', 1, 8484.24, '2025-08-20', 'pending', 'Municipal + Education Tax (Total $16,968.48 for year)'),
  ('81602c94-3373-4ae6-ae3c-6b79f2b463a5', '681ecd18-5569-42b2-bd13-4dd38ff7762c', 2025, 'Dummerston, VT', 2, 8484.24, '2026-02-20', 'pending', 'Municipal + Education Tax')
ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET
  amount = EXCLUDED.amount,
  due_date = EXCLUDED.due_date,
  notes = EXCLUDED.notes;

-- ============================================
-- TAX RECORDS - Booth House (Dummerston, VT)
-- ============================================

INSERT INTO property_taxes (id, property_id, tax_year, jurisdiction, installment, amount, due_date, status, notes)
VALUES
  ('2829c6a9-2916-49ad-b292-cd0a794b19e7', 'd4a964c3-f090-453f-ae7a-7465b61f3b52', 2025, 'Dummerston, VT', 1, 3417.94, '2025-08-20', 'pending', 'Municipal + Education Tax (Total $6,835.88 for year)'),
  ('776a7a4b-afc8-41a7-9511-2880ad912778', 'd4a964c3-f090-453f-ae7a-7465b61f3b52', 2025, 'Dummerston, VT', 2, 3417.94, '2026-02-20', 'pending', 'Municipal + Education Tax')
ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET
  amount = EXCLUDED.amount,
  due_date = EXCLUDED.due_date,
  notes = EXCLUDED.notes;

-- ============================================
-- TAX RECORDS - Rhode Island House (Providence, RI)
-- ============================================

INSERT INTO property_taxes (id, property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
VALUES
  ('b5fc6eab-c626-4102-9b2c-5d55a492ce45', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 2025, 'Providence, RI', 1, 2327.67, '2025-07-24', 'confirmed', '2025-07-26', '2025-07-26', 'Quarterly Tax (Total $9,310.68 for year). Includes Elderly OO Exemption credit. Paid via eCheck - Confirmation: 320904623/320904626, Receipt: 14466543'),
  ('c03adcfb-d5f7-4791-b0a9-5c46b27d2451', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 2025, 'Providence, RI', 2, 2327.67, '2025-10-24', 'pending', NULL, NULL, 'Quarterly Tax'),
  ('4741790b-bff6-4c14-90e3-71ea8b88751a', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 2025, 'Providence, RI', 3, 2327.67, '2026-01-24', 'pending', NULL, NULL, 'Quarterly Tax'),
  ('113fc95f-d1c5-48f5-9df0-631cebf26b7c', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 2025, 'Providence, RI', 4, 2327.67, '2026-04-24', 'pending', NULL, NULL, 'Quarterly Tax')
ON CONFLICT (property_id, tax_year, jurisdiction, installment) DO UPDATE SET
  amount = EXCLUDED.amount,
  due_date = EXCLUDED.due_date,
  status = EXCLUDED.status,
  payment_date = EXCLUDED.payment_date,
  confirmation_date = EXCLUDED.confirmation_date,
  notes = EXCLUDED.notes;

COMMIT;

-- Verify the changes
SELECT 'Properties updated:' as info, count(*) as count FROM properties WHERE id IN (
  'c73f533a-9aa1-4eb2-9630-b93d210b19f3',
  '681ecd18-5569-42b2-bd13-4dd38ff7762c',
  '64482fc4-6d7f-4c9c-a55a-75ca208767fe',
  'd4a964c3-f090-453f-ae7a-7465b61f3b52',
  'bf3ab080-6cff-44b0-93e4-ad33479aa4a2'
) AND parcel_id IS NOT NULL;

SELECT 'Tax records for 2025:' as info, count(*) as count FROM property_taxes WHERE tax_year = 2025;
