-- Migration: 005_audit_log.sql
-- Created: 2026-01-01
-- Description: Create comprehensive user audit log table for tracking all user actions

-- =============================================================================
-- USER AUDIT LOG TABLE
-- =============================================================================
-- Stores a complete audit trail of all user actions in the system.
-- This enables:
--   - Security auditing (who did what, when)
--   - Change history (old vs new values)
--   - AI troubleshooting (trace requests across the system)
--   - Compliance requirements

CREATE TABLE IF NOT EXISTS user_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role user_role,

  -- What action was performed
  action TEXT NOT NULL,  -- create, update, delete, login, logout, confirm, mark_paid, import, export
  entity_type TEXT NOT NULL,  -- property, bill, vendor, vehicle, insurance_policy, etc.
  entity_id UUID,
  entity_name TEXT,  -- Human-readable: "Vermont Main House", "Bill #123", etc.

  -- Detailed change information
  changes JSONB,  -- For updates: { field: { old: value, new: value } }
  metadata JSONB DEFAULT '{}',  -- Additional context (input data, etc.)

  -- Request context for tracing
  request_id UUID,  -- Correlation ID to trace related operations
  ip_address INET,
  user_agent TEXT,
  path TEXT,  -- API route or action path

  -- When
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Query by user (e.g., "What did Barbara do this week?")
CREATE INDEX IF NOT EXISTS idx_user_audit_log_user
  ON user_audit_log(user_id);

-- Query by entity (e.g., "Show history of bill X")
CREATE INDEX IF NOT EXISTS idx_user_audit_log_entity
  ON user_audit_log(entity_type, entity_id);

-- Query by action (e.g., "Show all deletions")
CREATE INDEX IF NOT EXISTS idx_user_audit_log_action
  ON user_audit_log(action);

-- Query by time (e.g., "What happened today?")
CREATE INDEX IF NOT EXISTS idx_user_audit_log_created
  ON user_audit_log(created_at DESC);

-- Trace related operations (e.g., "What happened in request abc-123?")
CREATE INDEX IF NOT EXISTS idx_user_audit_log_request
  ON user_audit_log(request_id);

-- Composite for dashboard queries
CREATE INDEX IF NOT EXISTS idx_user_audit_log_recent_by_type
  ON user_audit_log(created_at DESC, entity_type);

-- =============================================================================
-- UPDATE EXISTING PAYMENT_AUDIT_LOG
-- =============================================================================
-- Add missing columns to the existing payment_audit_log table

ALTER TABLE payment_audit_log
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS ip_address INET;

-- Ensure performed_at has a default
ALTER TABLE payment_audit_log
  ALTER COLUMN performed_at SET DEFAULT NOW();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_audit_log IS 'Comprehensive audit trail of all user actions';
COMMENT ON COLUMN user_audit_log.action IS 'Action type: create, update, delete, login, logout, confirm, mark_paid, import, export';
COMMENT ON COLUMN user_audit_log.entity_type IS 'Entity type: property, bill, vendor, vehicle, property_tax, insurance_policy, etc.';
COMMENT ON COLUMN user_audit_log.changes IS 'For updates: JSON object mapping field names to {old, new} value pairs';
COMMENT ON COLUMN user_audit_log.request_id IS 'Correlation ID for tracing related log entries across the system';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 005_audit_log.sql completed successfully';
  RAISE NOTICE 'Created table: user_audit_log';
  RAISE NOTICE 'Created 6 indexes for efficient querying';
  RAISE NOTICE 'Updated table: payment_audit_log (added request_id, ip_address)';
END $$;
