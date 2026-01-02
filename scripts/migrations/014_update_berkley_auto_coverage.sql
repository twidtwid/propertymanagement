-- Migration 014: Update Berkley One auto insurance policies with detailed coverage data
-- Source: auto new-policy-documents.pdf from Dropbox
-- Extracted using Claude AI from policy documents

BEGIN;

-- Update policy-level fields for all RI vehicles with Berkley One policy
UPDATE insurance_policies
SET
  agent_name = 'Starkweather & Shepley Insurance Brokerage, Inc.',
  agent_phone = '(401) 435-3600',
  effective_date = '2025-11-01'
WHERE policy_number = 'PA04383042';

-- 2025 Ford Explorer - VIN: 1FMWK8GC1SGA89974
-- Premium: $2,123, Agreed Value: $63,700
UPDATE insurance_policies
SET
  premium_amount = 2123.00,
  premium_frequency = 'annual',
  coverage_details = '{
    "property_damage": 500000,
    "medical_payments": 5000,
    "uninsured_motorist": 500000,
    "comprehensive_deductible": 2000,
    "collision_deductible": 1000,
    "glass_deductible": 0,
    "agreed_value": 63700,
    "rental_reimbursement_max": 15000,
    "roadside_assistance": true,
    "full_glass_coverage": true
  }'::jsonb,
  notes = 'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551. Agreed Value $63,700. Full Glass Coverage included. Transportation Expense and Temporary Emergency Living Expenses $15,000. Roadside Assistance included.'
WHERE policy_number = 'PA04383042'
  AND vehicle_id = (SELECT id FROM vehicles WHERE vin = '1FMWK8GC1SGA89974');

-- 2023 Dodge Charger - VIN: 2C3CDXMG4PH661283
-- Premium: $3,051, Agreed Value: $35,800
UPDATE insurance_policies
SET
  premium_amount = 3051.00,
  premium_frequency = 'annual',
  coverage_details = '{
    "property_damage": 500000,
    "medical_payments": 5000,
    "uninsured_motorist": 500000,
    "comprehensive_deductible": 2000,
    "collision_deductible": 1000,
    "glass_deductible": 0,
    "agreed_value": 35800,
    "rental_reimbursement_max": 15000,
    "roadside_assistance": true,
    "full_glass_coverage": true
  }'::jsonb,
  notes = 'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551. Agreed Value $35,800. Full Glass Coverage included. Transportation Expense and Temporary Emergency Living Expenses $15,000. Roadside Assistance included.'
WHERE policy_number = 'PA04383042'
  AND vehicle_id = (SELECT id FROM vehicles WHERE vin = '2C3CDXMG4PH661283');

-- 2023 Chevrolet Equinox - VIN: 3GNAXXEG4PL113646
-- Premium: $1,980, Agreed Value: $30,400
UPDATE insurance_policies
SET
  premium_amount = 1980.00,
  premium_frequency = 'annual',
  coverage_details = '{
    "property_damage": 500000,
    "medical_payments": 5000,
    "uninsured_motorist": 500000,
    "comprehensive_deductible": 2000,
    "collision_deductible": 1000,
    "glass_deductible": 0,
    "agreed_value": 30400,
    "rental_reimbursement_max": 15000,
    "roadside_assistance": true,
    "full_glass_coverage": true
  }'::jsonb,
  notes = 'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551. Agreed Value $30,400. Full Glass Coverage included. Transportation Expense and Temporary Emergency Living Expenses $15,000. Roadside Assistance included.'
WHERE policy_number = 'PA04383042'
  AND vehicle_id = (SELECT id FROM vehicles WHERE vin = '3GNAXXEG4PL113646');

-- 2018 Chevrolet Equinox - VIN: 2GNAXWEX4J6162593
-- Premium: $1,713, Agreed Value: $18,000
UPDATE insurance_policies
SET
  premium_amount = 1713.00,
  premium_frequency = 'annual',
  coverage_details = '{
    "property_damage": 500000,
    "medical_payments": 5000,
    "uninsured_motorist": 500000,
    "comprehensive_deductible": 2000,
    "collision_deductible": 1000,
    "glass_deductible": 0,
    "agreed_value": 18000,
    "rental_reimbursement_max": 15000,
    "roadside_assistance": true,
    "full_glass_coverage": true
  }'::jsonb,
  notes = 'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551. Agreed Value $18,000. Full Glass Coverage included. Transportation Expense and Temporary Emergency Living Expenses $15,000. Roadside Assistance included.'
WHERE policy_number = 'PA04383042'
  AND vehicle_id = (SELECT id FROM vehicles WHERE vin = '2GNAXWEX4J6162593');

-- 2013 Chevrolet Traverse - VIN: 1GNKVLKD4DJ103781
-- Premium: $1,436, Agreed Value: $11,900
UPDATE insurance_policies
SET
  premium_amount = 1436.00,
  premium_frequency = 'annual',
  coverage_details = '{
    "property_damage": 500000,
    "medical_payments": 5000,
    "uninsured_motorist": 500000,
    "comprehensive_deductible": 2000,
    "collision_deductible": 1000,
    "glass_deductible": 0,
    "agreed_value": 11900,
    "rental_reimbursement_max": 15000,
    "roadside_assistance": true,
    "full_glass_coverage": true
  }'::jsonb,
  notes = 'RI auto policy - Agent: Starkweather & Shepley (401) 435-3600, Claims: (855) 663-8551. Agreed Value $11,900. Full Glass Coverage included. Transportation Expense and Temporary Emergency Living Expenses $15,000. Roadside Assistance included.'
WHERE policy_number = 'PA04383042'
  AND vehicle_id = (SELECT id FROM vehicles WHERE vin = '1GNKVLKD4DJ103781');

COMMIT;
