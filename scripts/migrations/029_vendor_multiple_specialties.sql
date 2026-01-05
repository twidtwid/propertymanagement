-- Migration: Convert vendor specialty from single enum to array
-- This allows vendors to have multiple specialties (e.g., Castine does Mowing and Plowing)

-- Step 1: Rename column (if still old name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'specialty') THEN
    ALTER TABLE vendors RENAME COLUMN specialty TO specialties;
  END IF;
END $$;

-- Step 2: Drop old default
ALTER TABLE vendors ALTER COLUMN specialties DROP DEFAULT;

-- Step 3: Convert to array type (wraps existing single value in array)
ALTER TABLE vendors ALTER COLUMN specialties TYPE vendor_specialty[] USING ARRAY[specialties];

-- Step 4: Set new array default
ALTER TABLE vendors ALTER COLUMN specialties SET DEFAULT ARRAY['other']::vendor_specialty[];

COMMENT ON COLUMN vendors.specialties IS 'Array of vendor specialties - vendors can have multiple';
