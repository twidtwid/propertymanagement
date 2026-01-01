-- Migration 008: Add fields for Dropbox document data integration
-- Run with: psql -h localhost -U postgres -d propertymanagement -f scripts/migrations/008_dropbox_data.sql

BEGIN;

-- Add agreed_value to vehicles for insurance valuation
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS agreed_value DECIMAL(10,2);

-- Add HOA fields to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hoa_monthly_amount DECIMAL(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hoa_management_company TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ownership_entity TEXT;

-- Add coverage_details JSONB to insurance_policies for line-item coverage breakdown
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS coverage_details JSONB;

-- Create Insurance Portfolio virtual property for umbrella/fine art policies
INSERT INTO properties (
    id, name, address, city, state, country, property_type, status, notes
) VALUES (
    gen_random_uuid(),
    'Insurance Portfolio',
    'N/A - Virtual Property',
    'N/A',
    NULL,
    'USA',
    'other',
    'active',
    'Virtual property to hold umbrella, fine art, and other multi-asset insurance policies that cover the entire portfolio rather than a single property.'
) ON CONFLICT DO NOTHING;

COMMIT;
