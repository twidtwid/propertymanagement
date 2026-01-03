-- Migration 020: Smart Pins (System vs User Pins)
-- Add ability to distinguish between system-generated pins and user pins

-- Add is_system_pin column to pinned_items
ALTER TABLE pinned_items
ADD COLUMN is_system_pin BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX idx_pinned_items_system_flag ON pinned_items(entity_type, is_system_pin);

-- Comment for documentation
COMMENT ON COLUMN pinned_items.is_system_pin IS 'True for system-generated smart pins (urgent, needs attention), false for user pins';
