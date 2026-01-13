-- Migration: Add HikVision cameras and credentials for Rhode Island House
-- Date: 2026-01-12

BEGIN;

-- Insert HikVision credentials
INSERT INTO camera_credentials (id, provider, credentials_encrypted, created_at, updated_at, property_id)
VALUES (
  'e23e6d49-7e5d-469b-a94c-8d6f70ab6e18',
  'hikvision',
  'CrQB03X305g+W0VQzu+o5NCSWPikt3sBR1RO/3Snt6WYjOeVUBJ+aJy5DcxrOr5GzWwbNfZ2eqYG+wR7FSmShytNi6XUbFPBQraMvIWavcUegYPAnzjE/sh/MykrFc/+dN+awGL4OJ7VSssM83ADNZTDigkSAEjnhkIMSwJ9o9oYswb5zy8bdDJlIsJ3U0jTFkicRtsD7il8AD1vdj8RZ2tNlEobqcehfEiRnyAxcQ==',
  '2026-01-12 14:14:13.406155+00',
  '2026-01-12 14:14:13.406155+00',
  'bf3ab080-6cff-44b0-93e4-ad33479aa4a2'
)
ON CONFLICT (id) DO NOTHING;

-- Insert HikVision cameras (10 cameras at Rhode Island House)
INSERT INTO cameras (id, property_id, provider, external_id, name, location, status, created_at, updated_at) VALUES
('b4721adc-1546-4733-9ecc-02b836bdf242', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '1', 'Front Door', 'Front Entrance', 'online', '2026-01-12 14:14:13.410045+00', '2026-01-12 14:14:13.410045+00'),
('6686eb21-2a8b-4aa0-bb07-cccbb27bf73e', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '2', 'Driveway', 'Driveway Area', 'online', '2026-01-12 14:40:07.368693+00', '2026-01-12 14:40:07.368693+00'),
('e3a2363c-6d14-4014-90f5-7fdeb483deec', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '3', 'Kitchen Door', 'Kitchen Entrance', 'online', '2026-01-12 14:40:07.370678+00', '2026-01-12 14:40:07.370678+00'),
('82ce4539-0685-4a39-9843-2a4f7efdabc2', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '4', 'Patio', 'Back Patio', 'online', '2026-01-12 14:40:07.371119+00', '2026-01-12 14:40:07.371119+00'),
('bd73b357-0ac1-4357-8034-3c77c7340b14', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '5', 'Driveway 2', 'Driveway (Secondary)', 'online', '2026-01-12 14:40:07.371561+00', '2026-01-12 14:40:07.371561+00'),
('911671cd-2ebc-4e96-9f2a-845f8ff0ea90', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '6', 'Side of House', 'Side Exterior', 'online', '2026-01-12 14:40:07.371864+00', '2026-01-12 14:40:07.371864+00'),
('f8ba5d04-58a7-4571-afc3-a4d607b9a075', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '7', 'Water Treatment', 'Water Treatment Area', 'online', '2026-01-12 14:40:07.372162+00', '2026-01-12 14:40:07.372162+00'),
('fbea0b03-e021-47a1-a356-1f239051da19', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '8', 'Laundry Room', 'Interior Laundry', 'online', '2026-01-12 14:40:07.372467+00', '2026-01-12 14:40:07.372467+00'),
('c8a0da83-3538-495b-8765-d6eea3504693', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '9', 'Rear Gate', 'Back Gate Entrance', 'online', '2026-01-12 14:40:07.372728+00', '2026-01-12 14:40:07.372728+00'),
('e8430157-4016-417f-a27d-343479d93269', 'bf3ab080-6cff-44b0-93e4-ad33479aa4a2', 'hikvision', '10', 'Side Alley', 'Side Alley Access', 'online', '2026-01-12 14:40:07.372989+00', '2026-01-12 14:40:07.372989+00')
ON CONFLICT (id) DO NOTHING;

COMMIT;
