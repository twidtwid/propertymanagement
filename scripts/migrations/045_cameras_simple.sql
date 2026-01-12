-- Simplified camera integration (MVP - static snapshots only)
-- Phase 1: Nest cameras in Vermont

-- Camera provider enum
CREATE TYPE camera_provider AS ENUM ('nest', 'hikvision', 'securityspy');

-- Camera status enum
CREATE TYPE camera_status AS ENUM ('online', 'offline', 'error', 'unknown');

-- Server-side credentials (NO user-facing OAuth)
CREATE TABLE camera_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider camera_provider NOT NULL,
  property_id UUID REFERENCES properties(id), -- NULL for Nest (covers multiple properties)
  credentials_encrypted TEXT NOT NULL, -- JSON: { access_token, refresh_token, etc }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cameras table (SIMPLIFIED - snapshots stored in single field)
CREATE TABLE cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider camera_provider NOT NULL,
  external_id TEXT NOT NULL, -- Provider's device ID
  name TEXT NOT NULL,
  location TEXT, -- "Front Door", "Driveway", etc.
  status camera_status DEFAULT 'unknown',
  snapshot_url TEXT, -- Cached snapshot URL (Dropbox public link)
  snapshot_captured_at TIMESTAMPTZ, -- When this snapshot was taken
  last_online TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, external_id)
);

CREATE INDEX idx_cameras_property ON cameras(property_id);
CREATE INDEX idx_cameras_status ON cameras(status);

-- Add camera sync to health check states
INSERT INTO health_check_state (check_name, status, last_checked_at, failure_count)
VALUES ('camera-sync', 'ok', NOW(), 0)
ON CONFLICT (check_name) DO NOTHING;
