-- Migration: Add missing vendor specialties (shoveling, plowing, mowing)
-- These were in the Zod schema but not the PostgreSQL enum

-- Add new enum values to vendor_specialty
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'shoveling';
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'plowing';
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'mowing';

COMMENT ON TYPE vendor_specialty IS 'Vendor specialty types including lawn care (mowing) and snow removal (plowing, shoveling)';
