-- Add user_description column to dropbox_file_summaries
-- When set, this overrides the AI-generated summary

ALTER TABLE dropbox_file_summaries
ADD COLUMN IF NOT EXISTS user_description TEXT;

COMMENT ON COLUMN dropbox_file_summaries.user_description IS 'User-provided description that overrides AI summary';
