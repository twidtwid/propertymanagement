-- Add window_washing to vendor_specialty enum
-- Must use ALTER TYPE ... ADD VALUE
ALTER TYPE vendor_specialty ADD VALUE IF NOT EXISTS 'window_washing' BEFORE 'other';
