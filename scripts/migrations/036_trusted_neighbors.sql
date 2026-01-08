-- Migration 036: Trusted Neighbors
-- Tracks trusted neighbors for each property who can help in emergencies

CREATE TABLE trusted_neighbors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  relationship TEXT,
  has_keys BOOLEAN DEFAULT FALSE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for property lookups
CREATE INDEX idx_trusted_neighbors_property ON trusted_neighbors(property_id);

-- Index for active neighbors
CREATE INDEX idx_trusted_neighbors_active ON trusted_neighbors(property_id)
  WHERE is_active = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_trusted_neighbors_updated_at
  BEFORE UPDATE ON trusted_neighbors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
