-- Migration 022: Add property_tax and insurance_premium to pinned entity types
-- This allows pinning property taxes and insurance premiums in the payments view

-- Add new enum values
ALTER TYPE pinned_entity_type ADD VALUE IF NOT EXISTS 'property_tax';
ALTER TYPE pinned_entity_type ADD VALUE IF NOT EXISTS 'insurance_premium';
ALTER TYPE pinned_entity_type ADD VALUE IF NOT EXISTS 'document';

-- Note: Enum values cannot be removed once added, so these are permanent additions
