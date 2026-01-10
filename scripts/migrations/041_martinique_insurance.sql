-- Migration: 041_martinique_insurance.sql
-- Add Martinique insurance policy (from Dropbox audit + PDF extraction)
-- Source: /Martinique/insurance Avis d'echeance.pdf (French insurance bill)

INSERT INTO insurance_policies (
  id, property_id, carrier_name, policy_number, policy_type,
  expiration_date, notes, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM properties WHERE name = 'Martinique Condo'),
  'Groupama Antilles-Guyane',
  'C211899/0002',
  'homeowners',
  '2025-12-31',
  'Customer ref: C254683. Premium: EUR 1,016.58/year. Coverage includes terrorism, legal protection, natural disaster. Property: Les Terrasses de la Plage, Anse Mitan, Les Trois Ilets.',
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM insurance_policies ip
  JOIN properties p ON ip.property_id = p.id
  WHERE p.name = 'Martinique Condo'
);
