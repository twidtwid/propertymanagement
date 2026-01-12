-- Migration: Add HikVision Camera 1 (FRONT DOOR) for testing
-- Date: 2026-01-12
-- Description: Test implementation with one camera before rolling out to all 10

-- 1. Insert encrypted credentials
INSERT INTO camera_credentials (provider, property_id, credentials_encrypted)
SELECT 'hikvision', p.id, 'CrQB03X305g+W0VQzu+o5NCSWPikt3sBR1RO/3Snt6WYjOeVUBJ+aJy5DcxrOr5GzWwbNfZ2eqYG+wR7FSmShytNi6XUbFPBQraMvIWavcUegYPAnzjE/sh/MykrFc/+dN+awGL4OJ7VSssM83ADNZTDigkSAEjnhkIMSwJ9o9oYswb5zy8bdDJlIsJ3U0jTFkicRtsD7il8AD1vdj8RZ2tNlEobqcehfEiRnyAxcQ=='
FROM properties p
WHERE p.name = 'Rhode Island House'
ON CONFLICT DO NOTHING;

-- 2. Insert Camera 1 (FRONT DOOR) for testing
INSERT INTO cameras (property_id, provider, external_id, name, location, status)
SELECT
  p.id,
  'hikvision',
  '1',                  -- Camera number (will map to channel 101 for snapshots)
  'Front Door',
  'Front Entrance',
  'unknown'
FROM properties p
WHERE p.name = 'Rhode Island House'
ON CONFLICT DO NOTHING;

-- 3. Verify insertion
SELECT
  c.id,
  c.name,
  c.provider,
  c.external_id,
  c.location,
  c.status,
  p.name as property_name
FROM cameras c
JOIN properties p ON c.property_id = p.id
WHERE c.provider = 'hikvision'
ORDER BY c.external_id;
