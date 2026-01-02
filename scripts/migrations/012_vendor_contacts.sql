-- Migration 012: Add vendor contacts table for multiple contacts per vendor
-- Date: 2025-01-01

-- Create vendor_contacts table
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor_id ON vendor_contacts(vendor_id);

-- Ensure only one primary contact per vendor
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_contacts_primary
  ON vendor_contacts(vendor_id)
  WHERE is_primary = TRUE;

-- Updated_at trigger
CREATE OR REPLACE TRIGGER vendor_contacts_updated_at
  BEFORE UPDATE ON vendor_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Migrate existing vendor contact data to vendor_contacts table
-- Only if vendor has name and at least one contact field
INSERT INTO vendor_contacts (vendor_id, name, email, phone, is_primary, notes)
SELECT
  id as vendor_id,
  name,
  email,
  phone,
  TRUE as is_primary,
  NULL as notes
FROM vendors
WHERE (email IS NOT NULL OR phone IS NOT NULL)
ON CONFLICT DO NOTHING;
