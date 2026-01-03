-- Migration 025: Add due_date to pin_notes
-- Add optional due date field to pin notes for calendar integration

ALTER TABLE pin_notes ADD COLUMN IF NOT EXISTS due_date DATE;

-- Index for calendar queries (find notes with upcoming due dates)
CREATE INDEX IF NOT EXISTS idx_pin_notes_due_date ON pin_notes(due_date) WHERE due_date IS NOT NULL;

-- Comments
COMMENT ON COLUMN pin_notes.due_date IS 'Optional due date for notes that need follow-up';
