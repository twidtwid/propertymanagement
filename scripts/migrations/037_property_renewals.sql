-- Migration 037: Property Renewals
-- Tracks annual inspections, certifications, and service renewals

CREATE TYPE renewal_type AS ENUM (
  'elevator_cert', 'fire_alarm', 'fire_suppression', 'generator_service',
  'septic', 'chimney', 'boiler_cert', 'backflow_test', 'pest_control',
  'hvac_service', 'pool_inspection', 'uva_renewal', 'rental_license',
  'building_permit', 'other'
);

CREATE TABLE property_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  renewal_type renewal_type NOT NULL,
  recurrence recurrence NOT NULL DEFAULT 'annual',
  due_date DATE NOT NULL,
  last_renewed DATE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  cost DECIMAL(10,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for property lookups
CREATE INDEX idx_property_renewals_property ON property_renewals(property_id);

-- Index for upcoming renewals (dashboard widget)
CREATE INDEX idx_property_renewals_due ON property_renewals(due_date)
  WHERE is_active = TRUE;

-- Index for vendor lookups
CREATE INDEX idx_property_renewals_vendor ON property_renewals(vendor_id)
  WHERE vendor_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_property_renewals_updated_at
  BEFORE UPDATE ON property_renewals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
