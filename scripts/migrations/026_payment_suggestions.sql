-- Migration: Payment Suggestions from Email
-- Purpose: Store AI-detected payment requests from vendor emails for user review

-- Create enum for suggestion status
DO $$ BEGIN
  CREATE TYPE payment_suggestion_status AS ENUM ('pending_review', 'imported', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for confidence level
DO $$ BEGIN
  CREATE TYPE payment_suggestion_confidence AS ENUM ('high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment_suggestions table
CREATE TABLE IF NOT EXISTS payment_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to source email
  email_id UUID REFERENCES vendor_communications(id) ON DELETE CASCADE,
  gmail_message_id TEXT, -- Backup reference if email deleted

  -- Extracted/matched data
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name_extracted TEXT, -- What we found in the email
  amount_extracted DECIMAL(12,2),
  due_date_extracted DATE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

  -- Detection metadata
  confidence payment_suggestion_confidence NOT NULL DEFAULT 'medium',
  signals TEXT[] DEFAULT '{}', -- e.g., ['invoice_keyword', 'amount_found', 'vendor_matched']
  email_subject TEXT,
  email_snippet TEXT,
  email_received_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  status payment_suggestion_status NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Review tracking
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Link to created bill (if imported)
  imported_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,

  -- Prevent duplicate suggestions for same email
  UNIQUE(email_id)
);

-- Index for quick lookup of pending suggestions
CREATE INDEX IF NOT EXISTS idx_payment_suggestions_pending
ON payment_suggestions(status, confidence)
WHERE status = 'pending_review';

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_payment_suggestions_email
ON payment_suggestions(email_id);

-- Index for gmail_message_id lookup (backup)
CREATE INDEX IF NOT EXISTS idx_payment_suggestions_gmail_id
ON payment_suggestions(gmail_message_id);

COMMENT ON TABLE payment_suggestions IS 'AI-detected payment requests from vendor emails awaiting user review';
COMMENT ON COLUMN payment_suggestions.signals IS 'Array of detection signals like invoice_keyword, amount_found, due_date_found, vendor_matched';
COMMENT ON COLUMN payment_suggestions.confidence IS 'high = vendor + amount + date, medium = vendor OR amount, low = keywords only';
