-- Migration: 041_martinique_insurance.sql
-- Add Martinique insurance policy (found in Dropbox audit)

INSERT INTO insurance_policies (
  id, property_id, carrier_name, policy_type,
  notes, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM properties WHERE name = 'Martinique Condo'),
  'Martinique Insurer',
  'homeowners',
  'Policy details in Dropbox: /Martinique/insurance Avis d''echeance.pdf - needs carrier name, policy number, expiration date',
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM insurance_policies ip
  JOIN properties p ON ip.property_id = p.id
  WHERE p.name = 'Martinique Condo'
);
