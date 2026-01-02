-- Migration 011: Add audiovisual vendor specialty and SmartHaven vendor
-- Date: 2025-01-01

-- Add audiovisual to the vendor_specialty enum
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'audiovisual';

-- Create SmartHaven vendor (audiovisual/smart home specialist)
INSERT INTO vendors (name, company, specialty, notes, is_active)
VALUES (
  'SmartHaven',
  'SmartHaven Smart Home Solutions',
  'audiovisual',
  'Smart home automation, AV systems, home theater',
  TRUE
)
ON CONFLICT DO NOTHING;
