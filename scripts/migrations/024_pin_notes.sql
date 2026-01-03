-- Migration 024: Pin Notes
-- Add ability for users to add contextual notes to pinned items

-- Pin notes table
CREATE TABLE IF NOT EXISTS pin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type pinned_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  note TEXT NOT NULL CHECK (LENGTH(note) <= 500),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- One note per user per pin
  UNIQUE(entity_type, entity_id, user_id)
);

-- Index for fast lookup of notes by entity
CREATE INDEX idx_pin_notes_entity_lookup ON pin_notes(entity_type, entity_id);

-- Index for user's notes
CREATE INDEX idx_pin_notes_user ON pin_notes(user_id);

-- Comments
COMMENT ON TABLE pin_notes IS 'User notes on pinned items - one note per user per pin';
COMMENT ON COLUMN pin_notes.note IS 'Note text, max 500 characters';
COMMENT ON COLUMN pin_notes.user_name IS 'Cached user name for display (e.g., "anne", "todd")';
