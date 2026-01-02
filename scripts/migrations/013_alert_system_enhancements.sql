-- Migration 013: Alert System Enhancements
-- Adds deduplication, auto-resolution, and smart alert features

-- Add new columns to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS entity_key TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_amount DECIMAL(12,2);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_label TEXT;

-- Create unique index on entity_key for deduplication (only for unresolved alerts)
-- This prevents duplicate alerts for the same entity while allowing re-alerting after resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_entity_key_unresolved
ON alerts(entity_key)
WHERE resolved_at IS NULL AND is_dismissed = FALSE;

-- Index for efficient alert retrieval (unread, undismissed, unexpired)
CREATE INDEX IF NOT EXISTS idx_alerts_active
ON alerts(user_id, created_at DESC)
WHERE is_dismissed = FALSE AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '7 days');

-- Index for cleanup of old alerts
CREATE INDEX IF NOT EXISTS idx_alerts_expires
ON alerts(expires_at)
WHERE expires_at IS NOT NULL;

-- Create alert_type enum for type safety (keeping TEXT for backwards compatibility)
-- We'll validate in application code instead

-- Add comment explaining entity_key format
COMMENT ON COLUMN alerts.entity_key IS 'Deduplication key in format: {alert_type}:{entity_id}. Examples: bill_due:uuid, tax_overdue:uuid, insurance_expiring:uuid';
COMMENT ON COLUMN alerts.resolved_at IS 'When the underlying issue was resolved (e.g., bill paid, check confirmed). Auto-set by resolution triggers.';
COMMENT ON COLUMN alerts.expires_at IS 'When this alert should be auto-archived. Typically 30 days after resolution or creation.';
COMMENT ON COLUMN alerts.source_amount IS 'The dollar amount associated with this alert, used for smart threshold calculations.';
COMMENT ON COLUMN alerts.action_url IS 'Direct URL for the primary action (e.g., payment page with bill pre-selected).';
COMMENT ON COLUMN alerts.action_label IS 'Label for the action button (e.g., "Pay Now", "Confirm", "View Policy").';

-- Update existing alerts to have entity_keys based on their related_table/related_id
UPDATE alerts
SET entity_key = alert_type || ':' || COALESCE(related_id::text, 'system')
WHERE entity_key IS NULL;

-- Function to auto-resolve alerts when underlying entity changes
CREATE OR REPLACE FUNCTION resolve_alerts_for_entity(
  p_related_table TEXT,
  p_related_id UUID,
  p_alert_types TEXT[]
) RETURNS INTEGER AS $$
DECLARE
  resolved_count INTEGER;
BEGIN
  UPDATE alerts
  SET resolved_at = NOW(),
      expires_at = NOW() + INTERVAL '7 days'
  WHERE related_table = p_related_table
    AND related_id = p_related_id
    AND alert_type = ANY(p_alert_types)
    AND resolved_at IS NULL;

  GET DIAGNOSTICS resolved_count = ROW_COUNT;
  RETURN resolved_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired alerts (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_alerts() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Mark expired alerts as dismissed (soft delete)
  UPDATE alerts
  SET is_dismissed = TRUE
  WHERE expires_at < NOW()
    AND is_dismissed = FALSE;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Hard delete alerts older than 90 days that are dismissed
  DELETE FROM alerts
  WHERE is_dismissed = TRUE
    AND created_at < NOW() - INTERVAL '90 days';

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION resolve_alerts_for_entity TO PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_alerts TO PUBLIC;
