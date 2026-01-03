-- Migration 023: Pinning System Improvements
-- Performance optimizations, audit trail, and orphaned pin cleanup

-- ============================================
-- PERFORMANCE: Add missing indexes
-- ============================================

-- Index for dismissed pins analytics
CREATE INDEX IF NOT EXISTS idx_pinned_items_dismissed_at
ON pinned_items(dismissed_at)
WHERE dismissed_at IS NOT NULL;

-- Composite index for smart pin queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_pinned_items_smart_active
ON pinned_items(entity_type, is_system_pin, dismissed_at)
WHERE is_system_pin = true;

-- ============================================
-- AUDIT TRAIL: Track who dismissed smart pins
-- ============================================

ALTER TABLE pinned_items
ADD COLUMN IF NOT EXISTS dismissed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE pinned_items
ADD COLUMN IF NOT EXISTS dismissed_by_name TEXT;

COMMENT ON COLUMN pinned_items.dismissed_by IS 'User who dismissed this smart pin';
COMMENT ON COLUMN pinned_items.dismissed_by_name IS 'Cached name of user who dismissed (for display without joins)';

-- ============================================
-- DATA INTEGRITY: Orphaned pin cleanup
-- ============================================

-- Function to clean up orphaned pins
-- Runs weekly via cron to remove pins pointing to deleted entities
CREATE OR REPLACE FUNCTION cleanup_orphaned_pins() RETURNS void AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Clean up vendor pins
  DELETE FROM pinned_items
  WHERE entity_type = 'vendor'
    AND NOT EXISTS (
      SELECT 1 FROM vendors WHERE id = pinned_items.entity_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned vendor pins', deleted_count;

  -- Clean up bill pins
  DELETE FROM pinned_items
  WHERE entity_type = 'bill'
    AND NOT EXISTS (
      SELECT 1 FROM bills WHERE id = pinned_items.entity_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned bill pins', deleted_count;

  -- Clean up ticket pins
  DELETE FROM pinned_items
  WHERE entity_type = 'ticket'
    AND NOT EXISTS (
      SELECT 1 FROM maintenance_tasks WHERE id = pinned_items.entity_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned ticket pins', deleted_count;

  -- Clean up insurance policy pins
  DELETE FROM pinned_items
  WHERE entity_type = 'insurance_policy'
    AND NOT EXISTS (
      SELECT 1 FROM insurance_policies WHERE id = pinned_items.entity_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned insurance policy pins', deleted_count;

  -- Clean up BuildingLink message pins
  DELETE FROM pinned_items
  WHERE entity_type = 'buildinglink_message'
    AND NOT EXISTS (
      SELECT 1 FROM vendor_communications WHERE id = pinned_items.entity_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned BuildingLink message pins', deleted_count;

  -- Clean up property tax pins
  DELETE FROM pinned_items
  WHERE entity_type = 'property_tax'
    AND NOT EXISTS (
      SELECT 1 FROM property_taxes WHERE id = pinned_items.entity_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned property tax pins', deleted_count;

  -- Clean up insurance premium pins (same table as insurance_policy)
  DELETE FROM pinned_items
  WHERE entity_type = 'insurance_premium'
    AND NOT EXISTS (
      SELECT 1 FROM insurance_policies WHERE id = pinned_items.entity_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned insurance premium pins', deleted_count;

  -- Document pins don't reference a table, metadata contains path
  -- Skip cleanup for documents as they're tracked by path hash
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_orphaned_pins() IS 'Removes pins pointing to deleted entities. Run weekly via cron.';

-- Run initial cleanup
SELECT cleanup_orphaned_pins();

-- ============================================
-- METADATA VALIDATION: Ensure smart pins have required fields
-- ============================================

-- Check constraint to ensure smart pins have title in metadata
ALTER TABLE pinned_items
ADD CONSTRAINT metadata_has_title
CHECK (
  is_system_pin = false OR
  (metadata ? 'title')
);

COMMENT ON CONSTRAINT metadata_has_title ON pinned_items IS
'Smart pins must have title in metadata for daily summary display';

-- ============================================
-- ANALYTICS: Pinned items stats view (optional)
-- ============================================

CREATE OR REPLACE VIEW pinned_items_stats AS
SELECT
  entity_type,
  COUNT(*) FILTER (WHERE is_system_pin = true AND dismissed_at IS NULL) as active_smart_pins,
  COUNT(*) FILTER (WHERE is_system_pin = false) as user_pins,
  COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL) as dismissed_smart_pins,
  AVG(EXTRACT(EPOCH FROM (COALESCE(dismissed_at, NOW()) - pinned_at))) as avg_pin_duration_seconds
FROM pinned_items
GROUP BY entity_type;

COMMENT ON VIEW pinned_items_stats IS 'Analytics view for pinned items by entity type';

-- Grant access to view
GRANT SELECT ON pinned_items_stats TO PUBLIC;
