-- Migration: 038_health_monitoring.sql
-- Health monitoring state tracking for Pushover notifications
-- Tracks status of each health check to enable:
--   - Deduplication (only alert on state changes)
--   - Recovery notifications (alert when issues resolve)
--   - Grace periods (don't alert on transient failures)

CREATE TABLE health_check_state (
  check_name TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ok',  -- 'ok' | 'warning' | 'critical'
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  last_alerted_at TIMESTAMPTZ,
  last_recovered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  first_failure_at TIMESTAMPTZ,  -- For grace period calculation
  details JSONB
);

-- Insert initial state for all health checks
INSERT INTO health_check_state (check_name, status) VALUES
  ('email_sync', 'ok'),
  ('dropbox_token', 'ok'),
  ('database', 'ok'),
  ('daily_summary', 'ok');
