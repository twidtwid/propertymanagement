-- Migration: 027_payment_email_links
-- Description: Link payments to their source/confirmation emails
-- Date: 2026-01-04

-- Create enum for link types
DO $$ BEGIN
  CREATE TYPE payment_email_link_type AS ENUM ('invoice', 'confirmation', 'reminder');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for payment types (matches UnifiedPayment source)
DO $$ BEGIN
  CREATE TYPE payment_source_type AS ENUM ('bill', 'property_tax', 'insurance_premium');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment_email_links table
CREATE TABLE IF NOT EXISTS payment_email_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Payment reference (polymorphic)
  payment_type payment_source_type NOT NULL,
  payment_id UUID NOT NULL,

  -- Email reference
  email_id UUID NOT NULL REFERENCES vendor_communications(id) ON DELETE CASCADE,

  -- Link metadata
  link_type payment_email_link_type NOT NULL DEFAULT 'confirmation',
  confidence DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00, for auto-matched links
  auto_matched BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Prevent duplicate links
  UNIQUE(payment_type, payment_id, email_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_payment_email_links_payment
  ON payment_email_links(payment_type, payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_email_links_email
  ON payment_email_links(email_id);

-- Add confirmation tracking to bills (for auto-pay detection)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS last_confirmation_email_id UUID REFERENCES vendor_communications(id);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS last_confirmation_date TIMESTAMP WITH TIME ZONE;

-- Comments
COMMENT ON TABLE payment_email_links IS 'Links payments (bills, taxes, premiums) to related emails (invoices, confirmations, reminders)';
COMMENT ON COLUMN payment_email_links.confidence IS 'Confidence score for auto-matched links (1.00 = manual/certain, lower = auto-detected)';
