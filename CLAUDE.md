# Property Management System - Implementation Guide

## Project Overview

A custom web application for managing 10 properties across 6 jurisdictions (Vermont, Brooklyn NY, Rhode Island, Martinique, Paris, San Jose CA) plus 7 vehicles.

**Users:**
- **Owners (full access):** Anne, Todd, Michael, Amelia
- **Bookkeeper (bills & payments only):** Barbara Brady @ CBIZ

**Primary Goals:**
1. Never miss a property tax payment or insurance renewal
2. Confirm all checks are cashed (Bank of America reliability issues)
3. Quick vendor lookup: "Who handles HVAC in Rhode Island?"
4. Track equipment lifecycles and forecast replacements
5. Mobile-first design for on-the-go access

---

## Technology Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (documents)
- **Hosting:** Vercel + Supabase

---

## Quick Start

```bash
# 1. Create the project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 2. Install dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install date-fns zod react-hook-form @hookform/resolvers
npm install lucide-react recharts
npm install -D @types/node

# 3. Initialize shadcn/ui
npx shadcn@latest init

# 4. Add shadcn components
npx shadcn@latest add button card input label select textarea table tabs badge dialog dropdown-menu form toast calendar popover command
```

---

## Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- User Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'owner',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  login_info TEXT,  -- Encrypted in production
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property-Vendor Relationships
CREATE TABLE property_vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  days_to_confirm INTEGER DEFAULT 14,  -- Alert if not confirmed within this many days
  -- Documents
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property Taxes (specific tracking)
CREATE TABLE property_taxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  jurisdiction TEXT NOT NULL,  -- e.g., "Brattleboro, VT", "NYC"
  installment INTEGER DEFAULT 1,  -- 1, 2, 3, 4 for quarterly
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Maintenance History (log of completed work)
CREATE TABLE maintenance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Seasonal Checklists
CREATE TABLE seasonal_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  season season NOT NULL,
  task TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Professional Contacts (Lawyers, Accountants)
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL,  -- e.g., "Main Lawyer", "Tax Accountant", "Bookkeeper"
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX idx_alerts_unread ON alerts(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policies (simplified - all authenticated users can access)
-- In production, add more granular policies based on user role

CREATE POLICY "Authenticated users can view all data" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Similar policies for other tables (owner = full access, bookkeeper = limited)
CREATE POLICY "All authenticated access" ON properties
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON vehicles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON vendors
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON property_vendors
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON equipment
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON bills
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON property_taxes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON insurance_policies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON insurance_claims
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON maintenance_tasks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON maintenance_history
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON documents
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON seasonal_tasks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated access" ON professionals
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_insurance_policies_updated_at BEFORE UPDATE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_insurance_claims_updated_at BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_maintenance_tasks_updated_at BEFORE UPDATE ON maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_professionals_updated_at BEFORE UPDATE ON professionals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Project Structure

```
/src
├── /app
│   ├── layout.tsx              # Root layout with sidebar
│   ├── page.tsx                # Dashboard
│   ├── /auth
│   │   ├── /login
│   │   │   └── page.tsx
│   │   ├── /signup
│   │   │   └── page.tsx
│   │   └── /callback
│   │       └── route.ts
│   ├── /properties
│   │   ├── page.tsx            # List all properties
│   │   ├── /[id]
│   │   │   └── page.tsx        # Property detail
│   │   └── /new
│   │       └── page.tsx        # Add property
│   ├── /vendors
│   │   ├── page.tsx            # Vendor directory + quick lookup
│   │   └── /[id]
│   │       └── page.tsx
│   ├── /payments
│   │   ├── page.tsx            # All bills/payments
│   │   └── /taxes
│   │       └── page.tsx        # Property tax calendar
│   ├── /insurance
│   │   ├── page.tsx            # All policies
│   │   └── /claims
│   │       └── page.tsx
│   ├── /maintenance
│   │   ├── page.tsx            # Tasks list
│   │   └── /history
│   │       └── page.tsx
│   ├── /vehicles
│   │   ├── page.tsx
│   │   └── /[id]
│   │       └── page.tsx
│   ├── /documents
│   │   └── page.tsx
│   ├── /reports
│   │   └── page.tsx
│   └── /settings
│       └── page.tsx
├── /components
│   ├── /ui                     # shadcn components
│   ├── /layout
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── mobile-nav.tsx
│   ├── /dashboard
│   │   ├── quick-contact.tsx   # "Who do I call?" widget
│   │   ├── upcoming-payments.tsx
│   │   ├── alerts-card.tsx
│   │   └── property-overview.tsx
│   ├── /properties
│   │   ├── property-card.tsx
│   │   ├── property-form.tsx
│   │   └── equipment-list.tsx
│   ├── /vendors
│   │   ├── vendor-lookup.tsx
│   │   ├── vendor-card.tsx
│   │   └── vendor-form.tsx
│   ├── /payments
│   │   ├── bill-form.tsx
│   │   ├── payment-status.tsx
│   │   └── tax-calendar.tsx
│   └── /shared
│       ├── data-table.tsx
│       ├── confirm-dialog.tsx
│       └── file-upload.tsx
├── /lib
│   ├── supabase
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client
│   │   └── middleware.ts
│   ├── utils.ts
│   └── constants.ts
├── /types
│   └── database.ts             # Generated types from Supabase
└── /hooks
    ├── use-properties.ts
    ├── use-vendors.ts
    └── use-alerts.ts
```

---

## Key Components to Build

### 1. Quick Vendor Lookup (Dashboard Widget)

```tsx
// components/dashboard/quick-contact.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Phone, Mail } from "lucide-react"

export function QuickContact() {
  const [selectedProperty, setSelectedProperty] = useState("")
  const [selectedSpecialty, setSelectedSpecialty] = useState("")
  const [vendor, setVendor] = useState(null)

  // Fetch vendor when both are selected
  // ...

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who Do I Call?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={setSelectedProperty}>
          <SelectTrigger>
            <SelectValue placeholder="Select property..." />
          </SelectTrigger>
          <SelectContent>
            {/* Property options */}
          </SelectContent>
        </Select>

        <Select onValueChange={setSelectedSpecialty}>
          <SelectTrigger>
            <SelectValue placeholder="Select service type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hvac">HVAC</SelectItem>
            <SelectItem value="plumbing">Plumbing</SelectItem>
            <SelectItem value="electrical">Electrical</SelectItem>
            {/* More options */}
          </SelectContent>
        </Select>

        {vendor && (
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold">{vendor.name}</h4>
            <p className="text-sm text-muted-foreground">{vendor.company}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" asChild>
                <a href={`tel:${vendor.phone}`}>
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`mailto:${vendor.email}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 2. Payment Confirmation Status

```tsx
// components/payments/payment-status.tsx
import { Badge } from "@/components/ui/badge"
import { differenceInDays } from "date-fns"

type PaymentStatusProps = {
  status: string
  paymentDate?: Date
  confirmationDate?: Date
  daysToConfirm?: number
}

export function PaymentStatus({
  status,
  paymentDate,
  confirmationDate,
  daysToConfirm = 14
}: PaymentStatusProps) {
  if (status === "confirmed") {
    return <Badge variant="success">Confirmed</Badge>
  }

  if (status === "sent" && paymentDate) {
    const daysSinceSent = differenceInDays(new Date(), paymentDate)
    if (daysSinceSent > daysToConfirm) {
      return <Badge variant="destructive">Needs Confirmation ({daysSinceSent} days)</Badge>
    }
    return <Badge variant="warning">Sent ({daysSinceSent} days ago)</Badge>
  }

  if (status === "overdue") {
    return <Badge variant="destructive">Overdue</Badge>
  }

  return <Badge variant="secondary">Pending</Badge>
}
```

---

## Seed Data Script

Create a script to import Anne's existing data:

```typescript
// scripts/seed-data.ts
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seedProperties() {
  const properties = [
    {
      name: "Vermont Main House",
      address: "2055 Sunset Lake Rd",
      city: "Dummerston",
      state: "VT",
      country: "USA",
      property_type: "house",
      span_number: "186-059-10695",
    },
    {
      name: "Booth House",
      address: "1910 Sunset Lake Rd",
      city: "Dummerston",
      state: "VT",
      country: "USA",
      property_type: "house",
      span_number: "186-059-10098",
      notes: "Named after previous owners. Separate land, separate house, own insurance and taxes. UVA renewal due.",
    },
    {
      name: "Vermont Guest House",
      address: "2001 Sunset Lake Rd",
      city: "Dummerston",
      state: "VT",
      country: "USA",
      property_type: "house",
    },
    {
      name: "Vermont Land (House to be demolished)",
      address: "22 Kelly Rd",
      city: "Brattleboro",
      state: "VT",
      country: "USA",
      property_type: "land",
      span_number: "081-025-11151",
      notes: "Has existing house - taxed and insured. Planned for demolition.",
    },
    {
      name: "Brooklyn Condo PH2E",
      address: "34 North 7th Street PH2E",
      city: "Brooklyn",
      state: "NY",
      country: "USA",
      property_type: "condo",
      block_number: "02324",
      lot_number: "1305",
    },
    {
      name: "Brooklyn Condo PH2F",
      address: "34 North 7th Street PH2F",
      city: "Brooklyn",
      state: "NY",
      country: "USA",
      property_type: "condo",
      block_number: "02324",
      lot_number: "1306",
      has_mortgage: true,
    },
    {
      name: "Rhode Island House",
      address: "88 Williams St",
      city: "Providence",
      state: "RI",
      country: "USA",
      property_type: "house",
      square_feet: 3500,
      notes: "Monitored alarm system, Hikvision cameras. Justin (Parker Construction) oversees.",
    },
    {
      name: "Martinique Condo",
      address: "27-29 Res Les Terrasses",
      city: "Fort-de-France",
      state: null,
      country: "Martinique",
      property_type: "condo",
    },
    {
      name: "Paris Condo",
      address: "TBD",
      city: "Paris",
      state: null,
      country: "France",
      property_type: "condo",
    },
    {
      name: "125 Dana Avenue",
      address: "125 Dana Avenue",
      city: "San Jose",
      state: "CA",
      country: "USA",
      property_type: "house",
    },
  ]

  const { data, error } = await supabase
    .from("properties")
    .insert(properties)
    .select()

  console.log("Properties seeded:", data?.length)
  if (error) console.error(error)
}

async function seedVehicles() {
  const vehicles = [
    {
      year: 2013,
      make: "Chevrolet",
      model: "Traverse",
      color: "Red",
      vin: "1GNKVLKD4DJ103781",
      license_plate: "646030",
      registration_state: "RI",
      registration_expires: "2027-10-31",
    },
    {
      year: 2023,
      make: "Chevrolet",
      model: "Equinox",
      color: "Black",
      license_plate: "1MR 579",
      registration_state: "RI",
      registration_expires: "2028-10-31",
      garage_location: "NYC Garage spot #43",
    },
    {
      year: 2018,
      make: "Chevrolet",
      model: "Equinox",
      color: "Green",
      vin: "2GNAXWEX4J6162593",
      license_plate: "PS-865",
      registration_state: "RI",
      registration_expires: "2028-10-31",
      notes: "Inspection OVERDUE. Sirius XM: BJDBU3MR",
    },
    {
      year: 2023,
      make: "Dodge",
      model: "Charger",
      color: "Sublime Green",
      vin: "2C3CDXMG4PH661283",
      license_plate: "IC-844",
      registration_state: "RI",
      registration_expires: "2028-10-31",
    },
    {
      year: 2025,
      make: "Ford",
      model: "Explorer",
      color: "Black",
      vin: "1FMWK8GC1SGA89974",
      license_plate: "1YM-444",
      registration_state: "RI",
      registration_expires: "2027-10-31",
      garage_location: "NYC garage spot #40",
      notes: "Berkley One insurance",
    },
    // Todd's cars (San Jose, CA) - GEICO insurance
    {
      year: 2013,
      make: "Chevrolet",
      model: "Camaro",
      color: "Yellow",
      vin: "2G1FT1EWXD9182976",
      license_plate: "K144D1",
      registration_state: "CA",
      notes: "Todd's car. GEICO insurance.",
    },
    {
      year: 2019,
      make: "Honda",
      model: "CR-V",
      color: "Beige",
      registration_state: "CA",
      notes: "Todd's car. Paid off. GEICO insurance.",
    },
  ]

  const { data, error } = await supabase
    .from("vehicles")
    .insert(vehicles)
    .select()

  console.log("Vehicles seeded:", data?.length)
  if (error) console.error(error)
}

// Run seeds
seedProperties()
seedVehicles()

/*
INSURANCE SUMMARY:

BERKLEY ONE:
- All Anne's properties (VT, Brooklyn, RI, Martinique, Paris)
- All Anne's vehicles (5 RI-registered cars)

GEICO:
- 125 Dana Ave, San Jose (Todd's house)
- Todd's 2 CA cars (Camaro, CR-V)

DRIVER'S LICENSES:
- Anne: RI 9511664
- Michael: RI 9420957
- Amelia: RI 3696576
- Todd: CA D2021514
*/
```

---

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Run SQL schema in SQL Editor
3. Enable Email auth in Authentication settings
4. Create storage bucket "documents" for file uploads
5. Copy API keys to environment variables

---

## Next Steps After Initial Setup

1. [ ] Create Next.js project with dependencies
2. [ ] Set up Supabase project and run schema
3. [ ] Implement authentication flow
4. [ ] Build dashboard with Quick Contact widget
5. [ ] Create properties CRUD
6. [ ] Create vendors CRUD with quick lookup
7. [ ] Build payment tracker with confirmation workflow
8. [ ] Add property tax calendar
9. [ ] Implement insurance tracking
10. [ ] Build reporting pages
11. [ ] Set up alert system
12. [ ] Import data from Mega Info.xlsx
13. [ ] Mobile PWA optimization
14. [ ] Deploy to Vercel

---

---

## Shared Property Task Lists

Anne maintains running task lists for caretakers/contractors (like Justin at Parker Construction who oversees RI and VT properties). This is a key feature to add.

### Example Task List Format

```
House at 88 Williams St, RI
- Basement fridge
- Tire pressure
- TV in soaking tub room either doesn't work or freezes up
- Chandelier switch in dining room
- Test all windows

2055 Sunset (VT Main House)
- Half-bath toilet runs
- Guest bedrooms in back toilet runs
- Plumbing in master shower/switches? Mixing
- Water stain ceiling second living room
- Lightbulbs out
- Grab bars in showers
- NEW ROOF
- Skylight waterproofing
- New thermostats
- Outlets near TV in main room - something wrong
- Traverse electrical
```

### Database Addition

```sql
-- Shared Task Lists (for caretakers/contractors)
CREATE TABLE shared_task_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to TEXT,  -- e.g., "Justin (Parker Construction)"
  assigned_contact TEXT,  -- phone/email
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shared_task_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shared_task_lists(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  priority task_priority DEFAULT 'medium',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Features

1. **Property-Specific Lists** - Each property can have multiple active task lists
2. **Assignee Tracking** - Track who the list is shared with (Justin, cleaning crew, etc.)
3. **Shareable Link** - Generate a simple read-only link to share via text/email
4. **Quick Add** - Easy way to add items from mobile
5. **Completion Tracking** - Mark items done without deleting them
6. **Copy to Maintenance** - Convert completed items to maintenance history records
7. **Print View** - Clean printable format for contractors

### UI Component

```tsx
// components/properties/shared-task-list.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Share, Printer } from "lucide-react"

export function SharedTaskList({ propertyId, listId }: Props) {
  const [newTask, setNewTask] = useState("")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Task List for Justin</CardTitle>
          <p className="text-sm text-muted-foreground">Parker Construction</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 py-2">
              <Checkbox
                checked={task.is_completed}
                onCheckedChange={() => toggleTask(task.id)}
              />
              <span className={task.is_completed ? "line-through text-muted-foreground" : ""}>
                {task.task}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Add task..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
          />
          <Button onClick={addTask}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Notes

- **Bank of America Issues:** The payment confirmation workflow is critical. Checks should be marked "needs confirmation" if not confirmed within 14 days.
- **Vermont Fuel Oil:** Consider adding a fuel level tracking feature in Phase 2 when home automation is added.
- **Mobile First:** All interfaces should work well on iPhone. Use large touch targets and simple navigation.
- **Bookkeeper Access:** Barbara Brady (CBIZ) - bills & payments only. Can view/manage bills and payment confirmations, but no access to property settings, documents, or reports.
- **Caretaker Lists:** Justin (Parker Construction) oversees both RI and VT properties - shared task lists are essential for communicating work items.
