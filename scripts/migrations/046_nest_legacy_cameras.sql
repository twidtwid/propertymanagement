-- Migration: Add legacy Nest camera support
-- Date: 2026-01-11
-- Description: Add 'nest_legacy' provider type and insert two Vermont Main House cameras

-- Add nest_legacy to camera_provider enum
ALTER TYPE camera_provider ADD VALUE IF NOT EXISTS 'nest_legacy';

-- Insert credentials placeholder (actual values added manually after extraction)
INSERT INTO camera_credentials (id, provider, property_id, credentials_encrypted, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'nest_legacy',
  NULL,  -- Covers multiple properties
  'PLACEHOLDER_ENCRYPTED_CREDENTIALS',
  NOW(),
  NOW()
);

-- Insert Entryway camera
INSERT INTO cameras (id, property_id, provider, external_id, name, location, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  p.id,
  'nest_legacy',
  'DEVICE_ID_TBD',  -- Extract from nest.com
  'Entryway',
  'Front Entry',
  'unknown',
  NOW(),
  NOW()
FROM properties p
WHERE p.name = 'Vermont Main House';

-- Insert Garage camera
INSERT INTO cameras (id, property_id, provider, external_id, name, location, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  p.id,
  'nest_legacy',
  'DEVICE_ID_TBD',  -- Extract from nest.com
  'Garage',
  'Garage Interior',
  'unknown',
  NOW(),
  NOW()
FROM properties p
WHERE p.name = 'Vermont Main House';

-- Verify insertion
SELECT
  c.name,
  c.provider,
  c.external_id,
  c.location,
  p.name as property_name
FROM cameras c
JOIN properties p ON c.property_id = p.id
WHERE c.provider = 'nest_legacy'
ORDER BY c.name;
