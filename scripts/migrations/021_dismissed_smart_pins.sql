-- Migration 021: Track Dismissed Smart Pins
-- When users unpin a smart pin, remember it so it doesn't come back

-- Add dismissed_at column to track when user dismissed a smart pin
ALTER TABLE pinned_items
ADD COLUMN dismissed_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of non-dismissed pins
CREATE INDEX idx_pinned_items_not_dismissed ON pinned_items(entity_type, entity_id)
WHERE dismissed_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN pinned_items.dismissed_at IS 'When user dismissed this smart pin (NULL = not dismissed). Smart pin sync respects dismissals.';
