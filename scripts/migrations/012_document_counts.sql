-- Add document_count column to dropbox_folder_mappings
ALTER TABLE dropbox_folder_mappings
ADD COLUMN IF NOT EXISTS document_count INTEGER DEFAULT 0;

-- Add last_count_updated timestamp
ALTER TABLE dropbox_folder_mappings
ADD COLUMN IF NOT EXISTS last_count_updated TIMESTAMPTZ;

-- Add content_hash to track file changes for incremental sync
ALTER TABLE dropbox_file_summaries
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add updated_at for tracking when summaries were last refreshed
ALTER TABLE dropbox_file_summaries
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
