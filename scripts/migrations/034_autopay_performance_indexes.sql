-- Migration 034: Performance indexes for autopay feature
-- Optimizes queries for upcoming autopays and confirmation checking

-- Index for finding confirmed autopay bills by vendor
-- Used by getConfirmedVendorIds() to check if payments already confirmed
CREATE INDEX IF NOT EXISTS idx_bills_vendor_autopay_confirmed
ON bills(vendor_id, confirmation_date)
WHERE payment_method = 'auto_pay' AND status = 'confirmed';

-- Index for finding recent vendor communications
-- Used by getUpcomingAutopays() to fetch emails for analysis
CREATE INDEX IF NOT EXISTS idx_vendor_comms_recent_inbound
ON vendor_communications(received_at DESC, vendor_id)
WHERE direction = 'inbound';

-- Composite index for autopay pattern matching
-- Helps with subject line and body searches
CREATE INDEX IF NOT EXISTS idx_vendor_comms_autopay_search
ON vendor_communications(vendor_id, received_at DESC)
WHERE direction = 'inbound';
