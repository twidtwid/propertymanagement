-- Migration: Add payment_analyzed_at to vendor_communications
-- This tracks which emails have been analyzed for payment suggestions
-- to prevent re-analyzing the same emails repeatedly

ALTER TABLE vendor_communications
ADD COLUMN IF NOT EXISTS payment_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Index for efficient querying of unanalyzed emails
CREATE INDEX IF NOT EXISTS idx_vc_payment_analyzed
ON vendor_communications (payment_analyzed_at)
WHERE payment_analyzed_at IS NULL;

-- Mark all emails that already have payment suggestions as analyzed
UPDATE vendor_communications vc
SET payment_analyzed_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM payment_suggestions ps
  WHERE ps.email_id = vc.id OR ps.gmail_message_id = vc.gmail_message_id
);

COMMENT ON COLUMN vendor_communications.payment_analyzed_at IS 'When this email was analyzed for payment suggestions (prevents re-analysis)';
