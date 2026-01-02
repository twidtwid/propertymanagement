-- Migration 013: Add Berkley One auto insurance policies for RI vehicles
-- Source: auto-id-cards.pdf from Dropbox
-- Policy Number: PA04383042
-- Effective: 11/01/2025 - 11/01/2026
-- Carrier: Berkley Insurance Company (Berkley One)
-- Agent: Starkweather & Shepley Insurance Brokerage

BEGIN;

-- Insert auto insurance policies for all 5 RI vehicles
-- Each vehicle gets its own policy entry (since insurance_policies.vehicle_id is 1:1)
-- All share the same policy number PA04383042

-- 2025 Ford Explorer
INSERT INTO insurance_policies (vehicle_id, policy_type, carrier_name, policy_number, expiration_date, auto_renew, notes)
SELECT id, 'auto', 'Berkley One', 'PA04383042', '2026-11-01', TRUE,
       'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551'
FROM vehicles WHERE vin = '1FMWK8GC1SGA89974'
ON CONFLICT DO NOTHING;

-- 2023 Dodge Charger
INSERT INTO insurance_policies (vehicle_id, policy_type, carrier_name, policy_number, expiration_date, auto_renew, notes)
SELECT id, 'auto', 'Berkley One', 'PA04383042', '2026-11-01', TRUE,
       'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551'
FROM vehicles WHERE vin = '2C3CDXMG4PH661283'
ON CONFLICT DO NOTHING;

-- 2023 Chevrolet Equinox
INSERT INTO insurance_policies (vehicle_id, policy_type, carrier_name, policy_number, expiration_date, auto_renew, notes)
SELECT id, 'auto', 'Berkley One', 'PA04383042', '2026-11-01', TRUE,
       'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551'
FROM vehicles WHERE vin = '3GNAXXEG4PL113646'
ON CONFLICT DO NOTHING;

-- 2018 Chevrolet Equinox
INSERT INTO insurance_policies (vehicle_id, policy_type, carrier_name, policy_number, expiration_date, auto_renew, notes)
SELECT id, 'auto', 'Berkley One', 'PA04383042', '2026-11-01', TRUE,
       'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551'
FROM vehicles WHERE vin = '2GNAXWEX4J6162593'
ON CONFLICT DO NOTHING;

-- 2013 Chevrolet Traverse
INSERT INTO insurance_policies (vehicle_id, policy_type, carrier_name, policy_number, expiration_date, auto_renew, notes)
SELECT id, 'auto', 'Berkley One', 'PA04383042', '2026-11-01', TRUE,
       'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551'
FROM vehicles WHERE vin = '1GNKVLKD4DJ103781'
ON CONFLICT DO NOTHING;

COMMIT;
