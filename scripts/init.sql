-- Property Management System Database Schema
-- PostgreSQL

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('owner', 'bookkeeper');
CREATE TYPE property_type AS ENUM ('house', 'condo', 'land', 'other');
CREATE TYPE property_status AS ENUM ('active', 'inactive', 'sold');
CREATE TYPE payment_status AS ENUM ('pending', 'sent', 'confirmed', 'overdue', 'cancelled');
CREATE TYPE payment_method AS ENUM ('check', 'auto_pay', 'online', 'wire', 'cash', 'other');
CREATE TYPE bill_type AS ENUM ('property_tax', 'insurance', 'utility', 'maintenance', 'mortgage', 'hoa', 'other');
CREATE TYPE recurrence AS ENUM ('one_time', 'monthly', 'quarterly', 'semi_annual', 'annual');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE insurance_type AS ENUM ('homeowners', 'auto', 'umbrella', 'flood', 'earthquake', 'liability', 'health', 'travel', 'other');
CREATE TYPE claim_status AS ENUM ('filed', 'in_progress', 'approved', 'denied', 'settled');
CREATE TYPE vendor_specialty AS ENUM (
  'hvac', 'plumbing', 'electrical', 'roofing', 'general_contractor',
  'landscaping', 'cleaning', 'pest_control', 'pool_spa', 'appliance',
  'locksmith', 'alarm_security', 'snow_removal', 'fuel_oil',
  'property_management', 'architect', 'movers', 'trash', 'internet',
  'phone', 'water', 'septic', 'forester', 'other'
);
CREATE TYPE season AS ENUM ('winter', 'spring', 'summer', 'fall', 'annual');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

-- ============================================
-- TABLES
-- ============================================

-- User Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role user_role DEFAULT 'owner',
  phone TEXT,
  password_hash TEXT, -- Stub auth - in production use proper auth
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'USA',
  postal_code TEXT,
  property_type property_type DEFAULT 'house',
  square_feet INTEGER,
  purchase_date DATE,
  purchase_price DECIMAL(12,2),
  current_value DECIMAL(12,2),
  -- Tax identifiers
  span_number TEXT,  -- Vermont SPAN
  block_number TEXT, -- NYC Block
  lot_number TEXT,   -- NYC Lot
  parcel_id TEXT,    -- Generic parcel ID
  -- Mortgage
  has_mortgage BOOLEAN DEFAULT FALSE,
  mortgage_lender TEXT,
  mortgage_account TEXT,
  mortgage_payment DECIMAL(10,2),
  mortgage_due_day INTEGER,
  -- Meta
  notes TEXT,
  status property_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  vin TEXT,
  license_plate TEXT,
  registration_state TEXT DEFAULT 'RI',
  registration_expires DATE,
  inspection_expires DATE,
  garage_location TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  specialty vendor_specialty DEFAULT 'other',
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  emergency_phone TEXT,
  account_number TEXT,
  payment_method payment_method,
  login_info TEXT,
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property-Vendor Relationships
CREATE TABLE property_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  specialty_override vendor_specialty,
  notes TEXT,
  last_service_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, vendor_id, specialty_override)
);

-- Equipment
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  install_date DATE,
  expected_lifespan_years INTEGER,
  warranty_expires DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  bill_type bill_type NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  due_date DATE NOT NULL,
  recurrence recurrence DEFAULT 'one_time',
  -- Payment tracking
  status payment_status DEFAULT 'pending',
  payment_method payment_method,
  payment_date DATE,
  payment_reference TEXT,
  -- Confirmation tracking (for checks)
  confirmation_date DATE,
  confirmation_notes TEXT,
  days_to_confirm INTEGER DEFAULT 14,
  -- Documents
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property Taxes
CREATE TABLE property_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  jurisdiction TEXT NOT NULL,
  installment INTEGER DEFAULT 1,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_url TEXT,
  status payment_status DEFAULT 'pending',
  payment_date DATE,
  confirmation_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, tax_year, jurisdiction, installment)
);

-- Insurance Policies
CREATE TABLE insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  policy_type insurance_type NOT NULL,
  carrier_name TEXT NOT NULL,
  policy_number TEXT,
  agent_name TEXT,
  agent_phone TEXT,
  agent_email TEXT,
  premium_amount DECIMAL(10,2),
  premium_frequency recurrence DEFAULT 'annual',
  coverage_amount DECIMAL(12,2),
  deductible DECIMAL(10,2),
  effective_date DATE,
  expiration_date DATE,
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_method payment_method,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insurance Claims
CREATE TABLE insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  claim_number TEXT,
  claim_date DATE NOT NULL,
  incident_date DATE,
  incident_description TEXT,
  claim_amount DECIMAL(10,2),
  settlement_amount DECIMAL(10,2),
  status claim_status DEFAULT 'filed',
  adjuster_name TEXT,
  adjuster_phone TEXT,
  notes TEXT,
  document_urls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance Tasks
CREATE TABLE maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority DEFAULT 'medium',
  due_date DATE,
  completed_date DATE,
  recurrence recurrence DEFAULT 'one_time',
  status task_status DEFAULT 'pending',
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance History
CREATE TABLE maintenance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  description TEXT NOT NULL,
  done_by TEXT,
  cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  document_type TEXT,
  filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seasonal Tasks
CREATE TABLE seasonal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  season season NOT NULL,
  task TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Professional Contacts
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  severity alert_severity DEFAULT 'info',
  related_table TEXT,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared Task Lists
CREATE TABLE shared_task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to TEXT,
  assigned_contact TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shared_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES shared_task_lists(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  priority task_priority DEFAULT 'medium',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGGING
-- ============================================

-- Audit log table to track all changes
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  old_row JSONB := NULL;
  new_row JSONB := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_row := to_jsonb(OLD);
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, old_row, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    -- Only log if there are actual changes
    IF old_row IS DISTINCT FROM new_row THEN
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
      VALUES (TG_TABLE_NAME, NEW.id, TG_OP, old_row, new_row);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_row := to_jsonb(NEW);
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NULL, new_row);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to important tables
CREATE TRIGGER audit_properties AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_vendors AFTER INSERT OR UPDATE OR DELETE ON vendors
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_bills AFTER INSERT OR UPDATE OR DELETE ON bills
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_property_taxes AFTER INSERT OR UPDATE OR DELETE ON property_taxes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_insurance_policies AFTER INSERT OR UPDATE OR DELETE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_maintenance_tasks AFTER INSERT OR UPDATE OR DELETE ON maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_property_vendors_property ON property_vendors(property_id);
CREATE INDEX idx_property_vendors_vendor ON property_vendors(vendor_id);
CREATE INDEX idx_bills_property ON bills(property_id);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_property_taxes_property ON property_taxes(property_id);
CREATE INDEX idx_property_taxes_due_date ON property_taxes(due_date);
CREATE INDEX idx_insurance_policies_expiration ON insurance_policies(expiration_date);
CREATE INDEX idx_maintenance_tasks_property ON maintenance_tasks(property_id);
CREATE INDEX idx_maintenance_tasks_due_date ON maintenance_tasks(due_date);
CREATE INDEX idx_alerts_user ON alerts(user_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Default user for stub auth
INSERT INTO profiles (email, full_name, role, phone, password_hash) VALUES
('anne@annespalter.com', 'Anne', 'owner', '555-0100', 'stub'),
('todd@dailey.info', 'Todd', 'owner', '555-0101', 'stub'),
('michael@example.com', 'Michael', 'owner', '555-0102', 'stub'),
('amelia@example.com', 'Amelia', 'owner', '555-0103', 'stub'),
('barbara@cbiz.com', 'Barbara Brady', 'bookkeeper', '555-0104', 'stub');

-- Properties
INSERT INTO properties (name, address, city, state, country, property_type, span_number, notes, status) VALUES
('Vermont Main House', '2055 Sunset Lake Rd', 'Dummerston', 'VT', 'USA', 'house', '186-059-10695', 'Main Vermont residence', 'active'),
('Booth House', '1910 Sunset Lake Rd', 'Dummerston', 'VT', 'USA', 'house', '186-059-10098', 'Named after previous owners. Separate land, separate house, own insurance and taxes. UVA renewal due.', 'active'),
('Vermont Guest House', '2001 Sunset Lake Rd', 'Dummerston', 'VT', 'USA', 'house', NULL, 'Guest accommodations', 'active'),
('Vermont Land', '22 Kelly Rd', 'Brattleboro', 'VT', 'USA', 'land', '081-025-11151', 'Has existing house - taxed and insured. Planned for demolition.', 'active'),
('Brooklyn Condo PH2E', '34 North 7th Street PH2E', 'Brooklyn', 'NY', 'USA', 'condo', NULL, NULL, 'active'),
('Brooklyn Condo PH2F', '34 North 7th Street PH2F', 'Brooklyn', 'NY', 'USA', 'condo', NULL, 'Has mortgage', 'active'),
('Rhode Island House', '88 Williams St', 'Providence', 'RI', 'USA', 'house', NULL, 'Monitored alarm system, Hikvision cameras. Justin (Parker Construction) oversees. 3,500 sq ft.', 'active'),
('Martinique Condo', '27-29 Res Les Terrasses', 'Fort-de-France', NULL, 'Martinique', 'condo', NULL, NULL, 'active'),
('Paris Condo', 'TBD', 'Paris', NULL, 'France', 'condo', NULL, NULL, 'active'),
('125 Dana Avenue', '125 Dana Avenue', 'San Jose', 'CA', 'USA', 'house', NULL, 'Todd''s house. GEICO insurance.', 'active'),
-- Brooklyn storage units (separate NYC tax lots)
('Brooklyn Storage Unit 44', '34 North 7th Street Unit 44', 'Brooklyn', 'NY', 'USA', 'other', NULL, 'Storage unit for PH2E. NYC Public Records: Market Value $1,995. Owner: SPALTER, MICHAEL (previously TERMAN, MICHAEL).', 'active'),
('Brooklyn Storage Unit 72', '34 North 7th Street Unit 72', 'Brooklyn', 'NY', 'USA', 'other', NULL, 'Storage unit for PH2F. NYC Public Records: Market Value $2,329. Owner: SPALTER, MICHAEL.', 'active');

-- Update Brooklyn condos with mortgage info and NYC public records data
UPDATE properties SET
  has_mortgage = TRUE,
  block_number = '02324',
  lot_number = '1306',
  current_value = 569290,
  notes = COALESCE(notes || E'\n', '') || 'NYC Public Records: Market Value $569,290, Assessed Value $256,180. Owner: SPALTER, MICHAEL. 421-a tax abatement through 2036.'
WHERE name = 'Brooklyn Condo PH2F';

UPDATE properties SET
  block_number = '02324',
  lot_number = '1305',
  current_value = 522114,
  notes = 'NYC Public Records: Market Value $522,114, Assessed Value $234,951. Owner: SPALTER, MICHAEL (previously TERMAN, MICHAEL). 421-a tax abatement through 2036.'
WHERE name = 'Brooklyn Condo PH2E';

-- Update Brooklyn storage units with block/lot numbers
UPDATE properties SET block_number = '02324', lot_number = '1352', current_value = 1995 WHERE name = 'Brooklyn Storage Unit 44';
UPDATE properties SET block_number = '02324', lot_number = '1380', current_value = 2329 WHERE name = 'Brooklyn Storage Unit 72';

UPDATE properties SET square_feet = 3500, current_value = 712300 WHERE name = 'Rhode Island House';

-- Update San Jose property with verified APN
UPDATE properties SET parcel_id = '274-15-034' WHERE name = '125 Dana Avenue';

-- Vehicles
INSERT INTO vehicles (year, make, model, color, vin, license_plate, registration_state, registration_expires, garage_location, notes, is_active) VALUES
(2013, 'Chevrolet', 'Traverse', 'Red', '1GNKVLKD4DJ103781', '646030', 'RI', '2027-10-31', NULL, 'AC repair at automall. CarPlay installed at Traveling Electronics 603-352-2066', TRUE),
(2023, 'Chevrolet', 'Equinox', 'Black', '3GNAXXEG4PL113646', '1MR 579', 'RI', '2028-10-31', 'NYC Garage spot #43', NULL, TRUE),
(2018, 'Chevrolet', 'Equinox', 'Green', '2GNAXWEX4J6162593', 'PS-865', 'RI', '2028-10-31', NULL, 'Sirius XM: BJDBU3MR. Amica: 91013821LZ. Inspection OVERDUE', TRUE),
(2023, 'Dodge', 'Charger', 'Sublime Green', '2C3CDXMG4PH661283', 'IC-844', 'RI', '2028-10-31', NULL, 'Dodge app pin is gate, town is in RI', TRUE),
(2025, 'Ford', 'Explorer', 'Black', '1FMWK8GC1SGA89974', '1YM-444', 'RI', '2027-10-31', 'NYC garage spot #40', 'Berkley One insurance. Ford Customer Care: 1-800-392-3673. Scratch right side fixed ~$5K, Amica covering', TRUE),
(2013, 'Chevrolet', 'Camaro', 'Yellow', '2G1FT1EWXD9182976', 'K144D1', 'CA', NULL, NULL, 'Todd''s car in San Jose. GEICO insurance. Previously RI plate 409352, then CA 9TXN234', TRUE),
(2019, 'Honda', 'CR-V', 'Beige', NULL, '8HTD398', 'CA', NULL, NULL, 'Todd''s car. Paid off. GEICO insurance', TRUE);

-- Vendors
INSERT INTO vendors (name, company, specialty, phone, email, notes, is_active) VALUES
('Justin', 'Parker Construction', 'general_contractor', '555-0201', 'justin@parkerconstruction.com', 'Oversees RI and VT properties', TRUE),
('Vermont HVAC Co', 'Vermont HVAC Co', 'hvac', '555-0202', NULL, 'VT HVAC service', TRUE),
('Providence Plumbing', 'Providence Plumbing', 'plumbing', '555-0203', NULL, 'RI plumbing service', TRUE),
('Brooklyn Electric', 'Brooklyn Electric', 'electrical', '555-0204', NULL, 'NYC electrical service', TRUE),
('Green Mountain Fuel', 'Green Mountain Fuel', 'fuel_oil', '555-0205', NULL, 'VT fuel oil delivery', TRUE),
('ABC Roofing', 'ABC Roofing', 'roofing', '555-0206', NULL, 'VT roofing contractor', TRUE),
('Island Services', 'Island Services', 'property_management', '555-0207', NULL, 'Martinique property management', TRUE),
('Paris Maintenance', 'Paris Maintenance', 'property_management', '555-0208', NULL, 'Paris property management', TRUE);

-- Link vendors to properties
INSERT INTO property_vendors (property_id, vendor_id, is_primary, specialty_override)
SELECT p.id, v.id, TRUE, NULL
FROM properties p, vendors v
WHERE p.name = 'Vermont Main House' AND v.name = 'Justin';

INSERT INTO property_vendors (property_id, vendor_id, is_primary, specialty_override)
SELECT p.id, v.id, TRUE, NULL
FROM properties p, vendors v
WHERE p.name = 'Rhode Island House' AND v.name = 'Justin';

INSERT INTO property_vendors (property_id, vendor_id, is_primary, specialty_override)
SELECT p.id, v.id, TRUE, 'hvac'
FROM properties p, vendors v
WHERE p.name = 'Vermont Main House' AND v.name = 'Vermont HVAC Co';

INSERT INTO property_vendors (property_id, vendor_id, is_primary, specialty_override)
SELECT p.id, v.id, TRUE, 'plumbing'
FROM properties p, vendors v
WHERE p.name = 'Rhode Island House' AND v.name = 'Providence Plumbing';

-- Insurance Policies
INSERT INTO insurance_policies (property_id, policy_type, carrier_name, policy_number, premium_amount, premium_frequency, expiration_date, auto_renew, notes)
SELECT id, 'homeowners', 'Berkley One', 'BK-001', 2500.00, 'annual', '2025-12-31', TRUE, 'Anne''s properties'
FROM properties WHERE name = 'Vermont Main House';

INSERT INTO insurance_policies (property_id, policy_type, carrier_name, policy_number, premium_amount, premium_frequency, expiration_date, auto_renew, notes)
SELECT id, 'homeowners', 'Berkley One', 'BK-002', 2200.00, 'annual', '2025-12-31', TRUE, NULL
FROM properties WHERE name = 'Rhode Island House';

INSERT INTO insurance_policies (property_id, policy_type, carrier_name, policy_number, premium_amount, premium_frequency, expiration_date, auto_renew, notes)
SELECT id, 'homeowners', 'GEICO', 'GE-001', 1800.00, 'annual', '2025-06-30', TRUE, 'Todd''s house'
FROM properties WHERE name = '125 Dana Avenue';

-- Vehicle insurance
INSERT INTO insurance_policies (vehicle_id, policy_type, carrier_name, policy_number, premium_amount, premium_frequency, expiration_date, notes)
SELECT id, 'auto', 'Berkley One', 'BK-AUTO-001', 1200.00, 'semi_annual', '2025-06-30', 'Anne''s vehicles'
FROM vehicles WHERE registration_state = 'RI' LIMIT 1;

INSERT INTO insurance_policies (vehicle_id, policy_type, carrier_name, policy_number, premium_amount, premium_frequency, expiration_date, notes)
SELECT id, 'auto', 'GEICO', 'GE-AUTO-001', 900.00, 'semi_annual', '2025-06-30', 'Todd''s vehicles'
FROM vehicles WHERE registration_state = 'CA' LIMIT 1;

-- Property Taxes - Vermont Main House
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'Dummerston, VT', 1, 3500.00, '2025-02-15', 'pending', NULL, NULL, 'First half'
FROM properties WHERE name = 'Vermont Main House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'Dummerston, VT', 2, 3500.00, '2025-08-15', 'pending', NULL, NULL, 'Second half'
FROM properties WHERE name = 'Vermont Main House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Dummerston, VT', 1, 4850.00, '2024-08-15', 'confirmed', '2024-08-10', '2024-08-20', 'First half'
FROM properties WHERE name = 'Vermont Main House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Dummerston, VT', 2, 4850.00, '2025-02-15', 'pending', NULL, NULL, 'Second half'
FROM properties WHERE name = 'Vermont Main House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Dummerston, VT', 1, 4650.00, '2023-08-15', 'confirmed', '2023-08-12', '2023-08-22', 'First half'
FROM properties WHERE name = 'Vermont Main House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Dummerston, VT', 2, 4650.00, '2024-02-15', 'confirmed', '2024-02-10', '2024-02-20', 'Second half'
FROM properties WHERE name = 'Vermont Main House';

-- Property Taxes - Brooklyn Condo PH2E (421-a abatement through 2036)
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'NYC', 1, 110.09, '2025-07-01', 'pending', NULL, NULL, '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2E';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'NYC', 1, 108.50, '2024-07-01', 'confirmed', '2024-06-28', '2024-07-05', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2E';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'NYC', 1, 106.75, '2023-07-01', 'confirmed', '2023-06-25', '2023-07-03', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2E';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2022, 'NYC', 1, 104.25, '2022-07-01', 'confirmed', '2022-06-27', '2022-07-08', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2E';

-- Property Taxes - Brooklyn Condo PH2F (421-a abatement through 2036)
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'NYC', 1, 120.04, '2025-07-01', 'pending', NULL, NULL, '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2F';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'NYC', 1, 118.25, '2024-07-01', 'confirmed', '2024-06-28', '2024-07-05', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2F';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'NYC', 1, 116.50, '2023-07-01', 'confirmed', '2023-06-25', '2023-07-03', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2F';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2022, 'NYC', 1, 114.00, '2022-07-01', 'confirmed', '2022-06-27', '2022-07-08', '421-a abatement'
FROM properties WHERE name = 'Brooklyn Condo PH2F';

-- Property Taxes - Rhode Island House (quarterly)
-- Verified: Assessed value $712,300 (city-data.com), Tax rate $8.40/$1000 owner-occupied (FY 2026)
-- Annual tax = $712,300 × $8.40/$1000 = $5,983.32, Quarterly = $1,495.83
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Providence, RI', 1, 1495.83, '2024-07-24', 'confirmed', '2024-07-20', '2024-07-28', 'Q1 - Calculated from verified assessed value $712,300 × $8.40/$1000 rate'
FROM properties WHERE name = 'Rhode Island House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Providence, RI', 2, 1495.83, '2024-10-24', 'confirmed', '2024-10-20', '2024-10-28', 'Q2'
FROM properties WHERE name = 'Rhode Island House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Providence, RI', 3, 1495.83, '2025-01-24', 'pending', NULL, NULL, 'Q3'
FROM properties WHERE name = 'Rhode Island House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Providence, RI', 4, 1495.83, '2025-04-24', 'pending', NULL, NULL, 'Q4'
FROM properties WHERE name = 'Rhode Island House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Providence, RI', 1, 1450.00, '2023-07-24', 'confirmed', '2023-07-20', '2023-07-28', 'Q1 - Est. from prior year assessed value'
FROM properties WHERE name = 'Rhode Island House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Providence, RI', 2, 1450.00, '2023-10-24', 'confirmed', '2023-10-20', '2023-10-28', 'Q2'
FROM properties WHERE name = 'Rhode Island House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Providence, RI', 3, 1450.00, '2024-01-24', 'confirmed', '2024-01-20', '2024-01-28', 'Q3'
FROM properties WHERE name = 'Rhode Island House';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Providence, RI', 4, 1450.00, '2024-04-24', 'confirmed', '2024-04-20', '2024-04-28', 'Q4'
FROM properties WHERE name = 'Rhode Island House';

-- Property Taxes - 125 Dana Avenue, San Jose (semi-annual)
-- Verified via Santa Clara County Tax Collector (Playwright Dec 2025)
-- APN: 274-15-034, Tax Rate Area: 017-108
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'Santa Clara County, CA', 1, 5891.77, '2025-12-10', 'confirmed', '2025-12-10', '2025-12-10', 'Installment 1 - Verified from SCC Tax Collector'
FROM properties WHERE name = '125 Dana Avenue';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2025, 'Santa Clara County, CA', 2, 5891.77, '2026-04-10', 'pending', NULL, NULL, 'Installment 2'
FROM properties WHERE name = '125 Dana Avenue';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Santa Clara County, CA', 1, 5578.18, '2024-12-10', 'confirmed', '2025-01-24', '2025-01-24', 'Installment 1 - Paid late with $577.81 penalty'
FROM properties WHERE name = '125 Dana Avenue';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2024, 'Santa Clara County, CA', 2, 5578.18, '2025-04-10', 'confirmed', '2025-01-24', '2025-01-24', 'Installment 2'
FROM properties WHERE name = '125 Dana Avenue';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Santa Clara County, CA', 1, 5262.00, '2023-12-10', 'confirmed', '2023-12-08', '2023-12-15', 'Installment 1 - Estimated'
FROM properties WHERE name = '125 Dana Avenue';
INSERT INTO property_taxes (property_id, tax_year, jurisdiction, installment, amount, due_date, status, payment_date, confirmation_date, notes)
SELECT id, 2023, 'Santa Clara County, CA', 2, 5262.00, '2024-04-10', 'confirmed', '2024-04-08', '2024-04-15', 'Installment 2 - Estimated'
FROM properties WHERE name = '125 Dana Avenue';

-- Sample maintenance tasks
INSERT INTO maintenance_tasks (property_id, title, description, priority, due_date, status)
SELECT id, 'NEW ROOF', 'Full roof replacement needed', 'high', '2025-06-01', 'pending'
FROM properties WHERE name = 'Vermont Main House';

INSERT INTO maintenance_tasks (property_id, title, description, priority, due_date, status)
SELECT id, 'Half-bath toilet runs', 'Toilet continuously running', 'medium', '2025-02-01', 'pending'
FROM properties WHERE name = 'Vermont Main House';

INSERT INTO maintenance_tasks (property_id, title, description, priority, due_date, status)
SELECT id, 'Skylight waterproofing', 'Check and reseal skylights', 'high', '2025-04-01', 'pending'
FROM properties WHERE name = 'Vermont Main House';

INSERT INTO maintenance_tasks (property_id, title, description, priority, due_date, status)
SELECT id, 'TV in soaking tub room', 'TV either doesn''t work or freezes up', 'low', '2025-03-01', 'pending'
FROM properties WHERE name = 'Rhode Island House';

INSERT INTO maintenance_tasks (property_id, title, description, priority, due_date, status)
SELECT id, 'Chandelier switch in dining room', 'Switch needs repair/replacement', 'medium', '2025-02-15', 'pending'
FROM properties WHERE name = 'Rhode Island House';

-- Vehicle maintenance
INSERT INTO maintenance_tasks (vehicle_id, title, description, priority, due_date, status)
SELECT id, 'Inspection OVERDUE', 'Vehicle inspection is overdue', 'urgent', '2025-01-15', 'pending'
FROM vehicles WHERE license_plate = 'PS-865';

-- Professionals
INSERT INTO professionals (role, name, company, email, phone, notes, is_active) VALUES
('Bookkeeper', 'Barbara Brady', 'CBIZ', 'barbara@cbiz.com', '555-0300', 'Handles bills & payments', TRUE),
('Main Lawyer', 'TBD', NULL, NULL, NULL, NULL, TRUE),
('Tax Accountant', 'TBD', NULL, NULL, NULL, NULL, TRUE);

-- Shared Task Lists
INSERT INTO shared_task_lists (property_id, title, assigned_to, assigned_contact, is_active)
SELECT id, 'Tasks for Justin', 'Justin (Parker Construction)', '555-0201', TRUE
FROM properties WHERE name = 'Rhode Island House';

INSERT INTO shared_task_lists (property_id, title, assigned_to, assigned_contact, is_active)
SELECT id, 'Tasks for Justin', 'Justin (Parker Construction)', '555-0201', TRUE
FROM properties WHERE name = 'Vermont Main House';

-- Add items to RI task list
INSERT INTO shared_task_items (list_id, task, priority, sort_order)
SELECT stl.id, 'Basement fridge', 'medium', 1
FROM shared_task_lists stl
JOIN properties p ON stl.property_id = p.id
WHERE p.name = 'Rhode Island House' AND stl.title = 'Tasks for Justin';

INSERT INTO shared_task_items (list_id, task, priority, sort_order)
SELECT stl.id, 'Tire pressure', 'low', 2
FROM shared_task_lists stl
JOIN properties p ON stl.property_id = p.id
WHERE p.name = 'Rhode Island House' AND stl.title = 'Tasks for Justin';

INSERT INTO shared_task_items (list_id, task, priority, sort_order)
SELECT stl.id, 'Test all windows', 'medium', 3
FROM shared_task_lists stl
JOIN properties p ON stl.property_id = p.id
WHERE p.name = 'Rhode Island House' AND stl.title = 'Tasks for Justin';

-- Add items to VT task list
INSERT INTO shared_task_items (list_id, task, priority, sort_order)
SELECT stl.id, 'Half-bath toilet runs', 'medium', 1
FROM shared_task_lists stl
JOIN properties p ON stl.property_id = p.id
WHERE p.name = 'Vermont Main House' AND stl.title = 'Tasks for Justin';

INSERT INTO shared_task_items (list_id, task, priority, sort_order)
SELECT stl.id, 'Water stain ceiling second living room', 'medium', 2
FROM shared_task_lists stl
JOIN properties p ON stl.property_id = p.id
WHERE p.name = 'Vermont Main House' AND stl.title = 'Tasks for Justin';

INSERT INTO shared_task_items (list_id, task, priority, sort_order)
SELECT stl.id, 'Grab bars in showers', 'high', 3
FROM shared_task_lists stl
JOIN properties p ON stl.property_id = p.id
WHERE p.name = 'Vermont Main House' AND stl.title = 'Tasks for Justin';

INSERT INTO shared_task_items (list_id, task, priority, sort_order)
SELECT stl.id, 'NEW ROOF', 'urgent', 4
FROM shared_task_lists stl
JOIN properties p ON stl.property_id = p.id
WHERE p.name = 'Vermont Main House' AND stl.title = 'Tasks for Justin';
