-- Migration 011: Dropbox Documents Integration
-- Adds tables for Dropbox OAuth tokens, folder mappings, and file index

BEGIN;

-- ============================================================================
-- DROPBOX OAUTH TOKENS
-- ============================================================================
-- Stores encrypted OAuth tokens for Dropbox API access
-- Mirrors the gmail_oauth_tokens pattern

CREATE TABLE IF NOT EXISTS dropbox_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT UNIQUE NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  account_id TEXT,  -- Dropbox account ID
  root_folder_path TEXT DEFAULT '/Property Management',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: updated_at is handled in application code (auth.ts)

-- ============================================================================
-- DROPBOX FOLDER MAPPINGS
-- ============================================================================
-- Maps Dropbox folder paths to database entities (properties, vehicles, etc.)
-- This allows flexible configuration without code changes

CREATE TABLE IF NOT EXISTS dropbox_folder_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dropbox_folder_path TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('property', 'vehicle', 'insurance_portfolio')),
  entity_id UUID,  -- References properties.id, vehicles.id, or NULL for portfolio
  entity_name TEXT NOT NULL,  -- Human-readable name for display
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dropbox_mappings_entity ON dropbox_folder_mappings(entity_type, entity_id);
CREATE INDEX idx_dropbox_mappings_path ON dropbox_folder_mappings(dropbox_folder_path);

-- ============================================================================
-- DROPBOX FILE INDEX
-- ============================================================================
-- Cached index of Dropbox files for search and quick browsing
-- Updated via background sync job

CREATE TABLE IF NOT EXISTS dropbox_file_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dropbox_path TEXT NOT NULL UNIQUE,
  dropbox_id TEXT NOT NULL,  -- Dropbox file/folder ID
  name TEXT NOT NULL,
  is_folder BOOLEAN NOT NULL DEFAULT FALSE,
  file_size BIGINT,
  mime_type TEXT,
  modified_at TIMESTAMPTZ,
  parent_folder_path TEXT,
  -- Entity associations (derived from folder mapping)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  -- Document categorization
  document_category TEXT,  -- 'insurance', 'taxes', 'bills', 'maintenance', etc.
  -- Sync metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  content_hash TEXT  -- Dropbox content hash for change detection
);

CREATE INDEX idx_dropbox_files_parent ON dropbox_file_index(parent_folder_path);
CREATE INDEX idx_dropbox_files_property ON dropbox_file_index(property_id);
CREATE INDEX idx_dropbox_files_vehicle ON dropbox_file_index(vehicle_id);
CREATE INDEX idx_dropbox_files_category ON dropbox_file_index(document_category);
CREATE INDEX idx_dropbox_files_folder ON dropbox_file_index(is_folder);
CREATE INDEX idx_dropbox_files_name ON dropbox_file_index USING gin(to_tsvector('english', name));

-- ============================================================================
-- SEED FOLDER MAPPINGS
-- ============================================================================
-- Initial mappings based on current Dropbox folder structure
-- These can be updated via the admin interface later

-- Property mappings
INSERT INTO dropbox_folder_mappings (dropbox_folder_path, entity_type, entity_id, entity_name)
SELECT
  '/Property Management/Properties/' || name,
  'property',
  id,
  name
FROM properties
WHERE status = 'active'
ON CONFLICT (dropbox_folder_path) DO NOTHING;

-- Vehicle mappings
INSERT INTO dropbox_folder_mappings (dropbox_folder_path, entity_type, entity_id, entity_name)
SELECT
  '/Property Management/Vehicles/' || year || ' ' || make || ' ' || model,
  'vehicle',
  id,
  year || ' ' || make || ' ' || model
FROM vehicles
WHERE is_active = true
ON CONFLICT (dropbox_folder_path) DO NOTHING;

-- Insurance Portfolio mapping
INSERT INTO dropbox_folder_mappings (dropbox_folder_path, entity_type, entity_id, entity_name)
VALUES ('/Property Management/Insurance Portfolio', 'insurance_portfolio', NULL, 'Insurance Portfolio')
ON CONFLICT (dropbox_folder_path) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'dropbox_folder_mappings' as table_name, count(*) as row_count FROM dropbox_folder_mappings;
