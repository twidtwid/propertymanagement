-- Migration 013: BuildingLink Message Flags
-- Allows users to flag/pin important BuildingLink messages

CREATE TABLE IF NOT EXISTS buildinglink_message_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES vendor_communications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Index for fast lookup of user's flagged messages
CREATE INDEX IF NOT EXISTS idx_bl_flags_user ON buildinglink_message_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_flags_message ON buildinglink_message_flags(message_id);

COMMENT ON TABLE buildinglink_message_flags IS 'User-flagged BuildingLink messages that appear in Needs Attention section';
