-- Property Visibility System
-- Migration 007
--
-- Implements per-property visibility restrictions.
-- If a property has rows in property_visibility, ONLY those users can see it.
-- If a property has NO rows, all owners can see it (default behavior).

-- ============================================
-- PROPERTY VISIBILITY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS property_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_property_visibility_property ON property_visibility(property_id);
CREATE INDEX IF NOT EXISTS idx_property_visibility_user ON property_visibility(user_id);

-- ============================================
-- VEHICLE PROPERTY ASSOCIATION
-- ============================================

-- Add property_id to vehicles for visibility inheritance
-- Vehicles linked to a property inherit its visibility restrictions
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_property ON vehicles(property_id);

-- ============================================
-- SEED DATA: Restrict 125 Dana Avenue to Anne + Todd
-- ============================================

DO $$
DECLARE
  anne_id UUID;
  todd_id UUID;
  dana_property_id UUID;
BEGIN
  -- Get Anne's user ID
  SELECT id INTO anne_id FROM profiles WHERE email = 'anne@annespalter.com';

  -- Get Todd's user ID
  SELECT id INTO todd_id FROM profiles WHERE email = 'todd@dailey.info';

  -- Get Dana Avenue property ID
  SELECT id INTO dana_property_id FROM properties WHERE name = '125 Dana Avenue';

  -- Restrict Dana Avenue to Anne and Todd only
  IF anne_id IS NOT NULL AND todd_id IS NOT NULL AND dana_property_id IS NOT NULL THEN
    INSERT INTO property_visibility (property_id, user_id) VALUES
      (dana_property_id, anne_id),
      (dana_property_id, todd_id)
    ON CONFLICT (property_id, user_id) DO NOTHING;

    RAISE NOTICE 'Added visibility restrictions for 125 Dana Avenue';
  ELSE
    RAISE NOTICE 'Could not find required users or property for visibility setup';
  END IF;

  -- Link CA-registered vehicles to Dana Avenue
  IF dana_property_id IS NOT NULL THEN
    UPDATE vehicles
    SET property_id = dana_property_id
    WHERE registration_state = 'CA'
      AND property_id IS NULL;

    RAISE NOTICE 'Linked CA vehicles to 125 Dana Avenue';
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Show visibility configuration
SELECT
  p.name as property,
  pr.full_name as visible_to,
  pr.email
FROM property_visibility pv
JOIN properties p ON pv.property_id = p.id
JOIN profiles pr ON pv.user_id = pr.id
ORDER BY p.name, pr.full_name;

-- Show vehicles linked to properties
SELECT
  v.year, v.make, v.model, v.registration_state,
  p.name as home_property
FROM vehicles v
LEFT JOIN properties p ON v.property_id = p.id
WHERE v.property_id IS NOT NULL;
