-- Migration 019: Unified Shared Pinning System
-- Replace user-specific pinning (user_starred_vendors, buildinglink_message_flags)
-- with a shared polymorphic pinning table where all users see the same pins

-- Create enum for entity types
CREATE TYPE pinned_entity_type AS ENUM (
  'vendor',
  'bill',
  'insurance_policy',
  'ticket',
  'buildinglink_message'
);

-- Create unified pinned_items table
CREATE TABLE IF NOT EXISTS pinned_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type pinned_entity_type NOT NULL,
  entity_id UUID NOT NULL,

  -- Optional cached metadata for rich display in daily summary
  metadata JSONB,

  -- Audit trail
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pinned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pinned_by_name TEXT,  -- Denormalized for "Anne pinned this" attribution

  -- One pin per entity (shared across all users)
  UNIQUE(entity_type, entity_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pinned_items_entity_type ON pinned_items(entity_type);
CREATE INDEX IF NOT EXISTS idx_pinned_items_entity_lookup ON pinned_items(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pinned_items_pinned_at ON pinned_items(pinned_at DESC);

-- Comments for documentation
COMMENT ON TABLE pinned_items IS 'Shared pinned items across all users (family-wide pins)';
COMMENT ON COLUMN pinned_items.metadata IS 'Cached display metadata to avoid joins in daily summary';
COMMENT ON COLUMN pinned_items.pinned_by_name IS 'Denormalized for "Anne pinned this" attribution';

-- ============================================================================
-- MIGRATION: Merge all users' pins into shared pins
-- Strategy: If ANY user pinned it, it's valuable to everyone
-- ============================================================================

-- Migrate vendor stars (if table exists)
INSERT INTO pinned_items (entity_type, entity_id, pinned_by, pinned_by_name, metadata)
SELECT DISTINCT ON (usv.vendor_id)
  'vendor'::pinned_entity_type,
  usv.vendor_id,
  usv.user_id,
  p.full_name,
  jsonb_build_object(
    'title', COALESCE(v.company, v.name),
    'specialty', v.specialty
  )
FROM user_starred_vendors usv
JOIN vendors v ON usv.vendor_id = v.id
JOIN profiles p ON usv.user_id = p.id
ORDER BY usv.vendor_id, usv.created_at ASC  -- Earliest pinner gets attribution
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- Migrate BuildingLink flags (if table exists)
INSERT INTO pinned_items (entity_type, entity_id, pinned_by, pinned_by_name, metadata)
SELECT DISTINCT ON (bmf.message_id)
  'buildinglink_message'::pinned_entity_type,
  bmf.message_id,
  bmf.user_id,
  p.full_name,
  jsonb_build_object(
    'title', vc.subject,
    'unit', COALESCE(vc.buildinglink_unit, 'unknown')
  )
FROM buildinglink_message_flags bmf
JOIN vendor_communications vc ON bmf.message_id = vc.id
JOIN profiles p ON bmf.user_id = p.id
ORDER BY bmf.message_id, bmf.created_at ASC
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- ============================================================================
-- ARCHIVE OLD TABLES (don't drop - keep for rollback)
-- ============================================================================

-- Archive user_starred_vendors (rename, don't drop)
ALTER TABLE user_starred_vendors RENAME TO _archive_user_starred_vendors;

-- Archive buildinglink_message_flags (rename, don't drop)
ALTER TABLE buildinglink_message_flags RENAME TO _archive_buildinglink_message_flags;

-- Note: After 30 days of successful operation, can drop archived tables:
-- DROP TABLE _archive_user_starred_vendors;
-- DROP TABLE _archive_buildinglink_message_flags;
