-- Migration 032: Add attorney specialty to vendor_specialty enum
-- Date: 2026-01-05

-- Add attorney specialty to the vendor_specialty enum
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'attorney' BEFORE 'other';
