-- Migration 044: Add autopay analysis columns to vendor_communications
-- Stores AI analysis results so we don't re-analyze on every page load

-- Add columns for autopay analysis
ALTER TABLE vendor_communications ADD COLUMN IF NOT EXISTS autopay_analyzed_at TIMESTAMPTZ;
ALTER TABLE vendor_communications ADD COLUMN IF NOT EXISTS is_upcoming_autopay BOOLEAN DEFAULT false;
ALTER TABLE vendor_communications ADD COLUMN IF NOT EXISTS autopay_amount NUMERIC(12,2);
ALTER TABLE vendor_communications ADD COLUMN IF NOT EXISTS autopay_date DATE;
ALTER TABLE vendor_communications ADD COLUMN IF NOT EXISTS autopay_confidence TEXT;

-- Index for efficient dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_comms_upcoming_autopay
ON vendor_communications(received_at DESC)
WHERE is_upcoming_autopay = true;

-- Index to find emails needing analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_comms_needs_autopay_analysis
ON vendor_communications(received_at DESC)
WHERE autopay_analyzed_at IS NULL
  AND direction = 'inbound';

COMMENT ON COLUMN vendor_communications.autopay_analyzed_at IS 'When this email was analyzed for autopay signals';
COMMENT ON COLUMN vendor_communications.is_upcoming_autopay IS 'True if email is an upcoming autopay notification';
COMMENT ON COLUMN vendor_communications.autopay_amount IS 'Extracted payment amount from autopay notification';
COMMENT ON COLUMN vendor_communications.autopay_date IS 'Extracted payment date from autopay notification';
COMMENT ON COLUMN vendor_communications.autopay_confidence IS 'AI confidence: high, medium, low';
