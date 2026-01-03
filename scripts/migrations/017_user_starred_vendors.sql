-- Migration 017: User Starred Vendors
-- Allows users to pin/star vendors for quick access
-- Similar to BuildingLink flagged messages

-- Table to track which vendors each user has starred
CREATE TABLE IF NOT EXISTS user_starred_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each user can only star a vendor once
    UNIQUE(user_id, vendor_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_starred_vendors_user_id ON user_starred_vendors(user_id);

-- Index for fast lookup by vendor (to check if any user has starred)
CREATE INDEX IF NOT EXISTS idx_user_starred_vendors_vendor_id ON user_starred_vendors(vendor_id);

COMMENT ON TABLE user_starred_vendors IS 'Tracks which vendors each user has starred/pinned for quick access';
