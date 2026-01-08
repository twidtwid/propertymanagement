-- Migration 035: Property Access Codes & Keys
-- Tracks access codes, keys, and who holds them for each property

CREATE TYPE access_type AS ENUM (
  'garage_code', 'alarm_code', 'house_key', 'gate_code',
  'lockbox', 'wifi_password', 'building_fob', 'mailbox_key',
  'storage_key', 'safe_combination', 'other'
);

CREATE TABLE property_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  access_type access_type NOT NULL,
  description TEXT NOT NULL,
  code_value TEXT,
  holder_name TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for property lookups
CREATE INDEX idx_property_access_property ON property_access(property_id);

-- Index for active items by property and type
CREATE INDEX idx_property_access_active ON property_access(property_id, access_type)
  WHERE is_active = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_property_access_updated_at
  BEFORE UPDATE ON property_access
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
