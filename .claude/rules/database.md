---
trigger: Database schema work, SQL queries, enum changes, migrations
paths: scripts/init.sql, scripts/migrations/*, src/types/database.ts, src/lib/schemas/index.ts
---

# Database Schema Reference

**Use this file when:** Working with database schema, writing SQL queries, modifying enums, or creating migrations.

---

## PostgreSQL Enums

**CRITICAL:** When modifying enums, update BOTH locations:
1. PostgreSQL: `scripts/init.sql` → ALTER TYPE statements
2. Zod: `src/lib/schemas/index.ts` → schema definitions

### User and Property Enums

```sql
-- User roles
user_role: owner | bookkeeper

-- Property types and status
property_type: house | condo | land | other
property_status: active | inactive | sold
```

### Payment and Bill Enums

```sql
-- Payment flow
payment_status: pending | sent | confirmed | overdue | cancelled
payment_method: check | auto_pay | online | wire | cash | other

-- Bill categorization
bill_type: property_tax | insurance | utility | maintenance | mortgage | hoa | other
recurrence: one_time | monthly | quarterly | semi_annual | annual
```

### Task and Alert Enums

```sql
-- Maintenance tasks
task_status: pending | in_progress | completed | cancelled
task_priority: low | medium | high | urgent

-- Weather and alerts
alert_severity: info | warning | critical
season: winter | spring | summer | fall | annual
```

### Insurance Enums

```sql
-- Policy types
insurance_type: homeowners | auto | umbrella | flood | earthquake |
                liability | health | travel | other

-- Claims
claim_status: filed | in_progress | approved | denied | settled
```

### Vendor Specialties (36 Categories)

```sql
-- Service providers (choose most specific)
hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning,
pest_control, pool_spa, appliance, locksmith, alarm_security, snow_removal,
fuel_oil, property_management, architect, movers, trash, internet, phone,
water, septic, forester, fireplace, insurance, auto, elevator, flooring,
parking, masonry, audiovisual, shoveling, plowing, mowing, attorney,
window_washing, other
```

**Specialty mapping:**
- For vendors offering multiple services, use primary service as `specialty`
- Property-specific overrides stored in `property_vendors.specialty_override`

---

## Core Tables

### Properties

**Primary identifiers by jurisdiction:**
- Vermont: `span_number` (format: `186-059-10695`)
- NYC: `block_number`, `lot_number`
- California: `parcel_id` (APN)
- Rhode Island: `parcel_id`

**Key relationships:**
```sql
properties → property_vendors (many-to-many with vendors)
          → property_visibility (role-based access)
          → equipment (HVAC, appliances, etc.)
          → bills (property-specific expenses)
          → property_taxes (installment tracking)
          → insurance_policies (property coverage)
          → maintenance_tasks (work orders)
          → shared_task_lists (seasonal tasks)
          → dropbox_folder_mappings (document folders)
```

### Vehicles

**Links to properties for inherited visibility:**
- `property_id` (nullable) - Vehicle inherits property's user access

**Key relationships:**
```sql
vehicles → bills (vehicle-specific expenses)
        → insurance_policies (auto coverage)
        → dropbox_folder_mappings (document folders)
```

### Vendors

**Many-to-many with properties via `property_vendors`:**
- `is_primary` - Indicates preferred vendor for specialty
- `specialty_override` - Different specialty per property

**Key relationships:**
```sql
vendors → vendor_contacts (multiple contacts per vendor)
       → property_vendors (property associations)
       → bills (invoices and payments)
       → vendor_communications (emails, CASCADE DELETE)
```

### Vendor Contacts

**Multiple contacts per vendor with optional primary designation:**

```sql
CREATE TABLE vendor_contacts (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensures only one primary contact per vendor
CREATE UNIQUE INDEX idx_vendor_contacts_primary
  ON vendor_contacts(vendor_id)
  WHERE is_primary = TRUE;
```

**Query pattern:**
```sql
SELECT v.*,
       vc.name as primary_contact_name,
       vc.email as primary_contact_email
FROM vendors v
LEFT JOIN vendor_contacts vc
  ON v.id = vc.vendor_id AND vc.is_primary = TRUE;
```

### Bills

**Optional foreign keys to property, vehicle, vendor:**

```sql
CREATE TABLE bills (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),  -- Nullable
  vehicle_id UUID REFERENCES vehicles(id),     -- Nullable
  vendor_id UUID REFERENCES vendors(id),       -- Nullable
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status payment_status DEFAULT 'pending',
  payment_method payment_method,
  payment_date DATE,
  confirmation_date DATE,
  days_to_confirm INTEGER DEFAULT 14,  -- Bank of America tracking
  -- ... other fields
);
```

**Status flow:**
```
pending → sent → confirmed
   ↓
overdue (if past due_date without payment)
   ↓
cancelled (manual action)
```

### Property Taxes

**Structured tracking with unique installment constraint:**

```sql
CREATE TABLE property_taxes (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id),
  tax_year INTEGER NOT NULL,
  jurisdiction TEXT NOT NULL,
  installment INTEGER NOT NULL,  -- 1-4 for quarterly, 1-2 for semi-annual
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status payment_status DEFAULT 'pending',
  -- ... other fields
  UNIQUE(property_id, tax_year, jurisdiction, installment)
);
```

**Indexes for performance:**
```sql
CREATE INDEX idx_property_taxes_due_date ON property_taxes(due_date);
CREATE INDEX idx_property_taxes_status ON property_taxes(status);
```

### Insurance Policies

**Links to property OR vehicle (not both):**

```sql
CREATE TABLE insurance_policies (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),  -- Nullable
  vehicle_id UUID REFERENCES vehicles(id),     -- Nullable
  carrier TEXT NOT NULL,
  policy_number TEXT,
  insurance_type insurance_type NOT NULL,
  coverage_details JSONB,  -- Line-item coverage amounts
  premium_amount DECIMAL(10,2),
  expiration_date DATE,
  -- ... other fields
  CHECK (
    (property_id IS NOT NULL AND vehicle_id IS NULL) OR
    (property_id IS NULL AND vehicle_id IS NOT NULL)
  )
);
```

**Coverage details structure:**
```json
{
  "dwelling": 500000,
  "personal_property": 250000,
  "liability": 1000000,
  "deductible": 2500
}
```

### Pinned Items

**Polymorphic table supporting smart pins and user pins:**

```sql
CREATE TABLE pinned_items (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,  -- vendor, bill, ticket, insurance_policy, etc.
  entity_id UUID NOT NULL,
  is_system_pin BOOLEAN DEFAULT FALSE,  -- TRUE = smart pin, FALSE = user pin
  metadata JSONB,  -- Cached display fields (title, amount, due_date, etc.)
  dismissed_at TIMESTAMPTZ,  -- Smart pins only (NULL = active)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)  -- One pin per entity
);
```

**Indexes:**
```sql
-- Hot path for active smart pins (3x faster than full table scan)
CREATE INDEX idx_pinned_items_smart_active
  ON pinned_items(entity_type, is_system_pin, dismissed_at)
  WHERE is_system_pin = TRUE AND dismissed_at IS NULL;

-- Analytics on dismissed pins
CREATE INDEX idx_pinned_items_dismissed_at
  ON pinned_items(dismissed_at)
  WHERE dismissed_at IS NOT NULL;
```

**Pin types:**
- **Smart pins** (`is_system_pin = TRUE`): Auto-generated by system, can be dismissed
- **User pins** (`is_system_pin = FALSE`): Manually created, deleted when unpinned

### Dropbox Integration

**OAuth tokens with encryption:**

```sql
CREATE TABLE dropbox_oauth_tokens (
  id UUID PRIMARY KEY,
  access_token TEXT NOT NULL,  -- Encrypted with AES-256-GCM
  refresh_token TEXT NOT NULL,  -- Encrypted
  namespace_id TEXT,  -- CRITICAL: '13490620643' for shared folder
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Folder mappings:**

```sql
CREATE TABLE dropbox_folder_mappings (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,  -- property, vehicle, insurance
  entity_id UUID NOT NULL,
  folder_path TEXT NOT NULL,  -- /Properties/{name}, /Vehicles/{name}
  UNIQUE(entity_type, entity_id)
);
```

**File summaries:**

```sql
CREATE TABLE dropbox_file_summaries (
  id UUID PRIMARY KEY,
  file_path TEXT UNIQUE NOT NULL,
  summary TEXT,  -- AI-generated (Claude Haiku)
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dropbox_file_summaries_path ON dropbox_file_summaries(file_path);
```

### Vendor Communications

**Gmail sync with CASCADE DELETE:**

```sql
CREATE TABLE vendor_communications (
  id UUID PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  gmail_message_id TEXT UNIQUE NOT NULL,
  direction TEXT NOT NULL,  -- inbound | outbound
  subject TEXT,
  from_address TEXT,
  to_address TEXT,
  received_at TIMESTAMPTZ,
  -- ... other fields
);
```

**Matching logic:**
- Email address exact match → vendor
- Email domain match → vendor website/email domain

---

## SQL Query Patterns

### Integer Casting for Date Arithmetic

```sql
-- ❌ WRONG: Causes "operator is not unique" error
WHERE due_date <= CURRENT_DATE + $1

-- ✅ CORRECT: Explicit type cast
WHERE due_date <= CURRENT_DATE + ($1::INTEGER)
```

### UUID Generation

```sql
-- ✅ CORRECT: Built-in PostgreSQL function (no extension)
INSERT INTO properties (id, name)
VALUES (gen_random_uuid(), 'Test Property');

-- ❌ WRONG: Requires uuid-ossp extension
VALUES (uuid_generate_v4(), 'Test Property');
```

### LEFT JOIN for Optional Relations

**Use when foreign keys can be NULL:**

```sql
SELECT
  b.id,
  b.amount,
  b.due_date,
  p.name as property_name,
  v.name as vendor_name,
  vh.make || ' ' || vh.model as vehicle_name
FROM bills b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN vendors v ON b.vendor_id = v.id
LEFT JOIN vehicles vh ON b.vehicle_id = vh.id
WHERE b.status = 'pending'
  AND b.due_date <= CURRENT_DATE + ($1::INTEGER);
```

### Enum Value Queries

**Always use proper enum values in queries:**

```sql
-- ✅ CORRECT: Enum literal
WHERE status = 'pending'::payment_status

-- ✅ ALSO CORRECT: String with type inference
WHERE status = 'pending'

-- ❌ WRONG: Invalid enum value
WHERE status = 'Pending'  -- Enums are case-sensitive
```

### Aggregation with Optional FKs

```sql
SELECT
  p.id,
  p.name,
  COUNT(b.id) as bill_count,
  COALESCE(SUM(b.amount), 0) as total_amount
FROM properties p
LEFT JOIN bills b ON p.id = b.property_id
  AND b.status = 'pending'
GROUP BY p.id, p.name;
```

---

## Performance Indexes

**Critical indexes for query performance:**

```sql
-- Bills
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_property_id ON bills(property_id);
CREATE INDEX idx_bills_vendor_id ON bills(vendor_id);

-- Property Taxes
CREATE INDEX idx_property_taxes_due_date ON property_taxes(due_date);
CREATE INDEX idx_property_taxes_status ON property_taxes(status);

-- Insurance Policies
CREATE INDEX idx_insurance_policies_expiration ON insurance_policies(expiration_date);

-- Maintenance Tasks
CREATE INDEX idx_maintenance_tasks_due_date ON maintenance_tasks(due_date);
CREATE INDEX idx_maintenance_tasks_status ON maintenance_tasks(status);

-- Alerts (partial index for unread only)
CREATE INDEX idx_alerts_user_unread
  ON alerts(user_id, is_read)
  WHERE is_read = FALSE;

-- Vendor Contacts (partial unique for primary)
CREATE UNIQUE INDEX idx_vendor_contacts_primary
  ON vendor_contacts(vendor_id)
  WHERE is_primary = TRUE;

-- Pinned Items (hot path for smart pins)
CREATE INDEX idx_pinned_items_smart_active
  ON pinned_items(entity_type, is_system_pin, dismissed_at)
  WHERE is_system_pin = TRUE AND dismissed_at IS NULL;
```

---

## Migration Workflow

**When creating migrations:**

1. **Create migration file:** `scripts/migrations/XXX_description.sql`
2. **Update types:** `src/types/database.ts` with new TypeScript types
3. **Update Zod:** `src/lib/schemas/index.ts` if user-facing
4. **Test locally:** Apply to dev database
5. **Run build:** `/build` to catch type errors
6. **Deploy:** `/migrate XXX_description.sql` on production

**Migration naming convention:**
```
001_initial_schema.sql
023_add_vendor_contacts.sql
046_nest_legacy_cameras.sql
```

**Migration template:**
```sql
-- Migration: <Description>
-- Date: YYYY-MM-DD
-- Author: <Name>

BEGIN;

-- Add your schema changes here
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS specialty_override TEXT;

-- Add indexes if needed
CREATE INDEX IF NOT EXISTS idx_vendors_specialty ON vendors(specialty);

COMMIT;
```

---

## Common Patterns

### Check for Existing Data

```sql
-- Safe upsert pattern
INSERT INTO health_check_state (check_name, status, last_checked_at)
VALUES ($1, $2, NOW())
ON CONFLICT (check_name)
DO UPDATE SET
  status = EXCLUDED.status,
  last_checked_at = EXCLUDED.last_checked_at;
```

### Conditional Updates

```sql
-- Only update if value changed
UPDATE bills
SET
  status = $2,
  updated_at = NOW()
WHERE id = $1
  AND status != $2;  -- Avoids unnecessary writes
```

### Soft Deletes vs Hard Deletes

```sql
-- Smart pins: Soft delete (dismiss)
UPDATE pinned_items
SET dismissed_at = NOW()
WHERE id = $1 AND is_system_pin = TRUE;

-- User pins: Hard delete
DELETE FROM pinned_items
WHERE id = $1 AND is_system_pin = FALSE;
```

---

## TypeScript Type Generation

**Always keep types in sync with database:**

```typescript
// src/types/database.ts
export type PaymentStatus = 'pending' | 'sent' | 'confirmed' | 'overdue' | 'cancelled'

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  confirmed: 'Confirmed',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

// Usage in components
import { paymentStatusLabels } from '@/types/database'
<Badge>{paymentStatusLabels[bill.status]}</Badge>
```

---

## Additional References

**Schema files:**
- Complete schema: `scripts/init.sql`
- Applied migrations: `scripts/migrations/*.sql`
- TypeScript types: `src/types/database.ts`
- Zod schemas: `src/lib/schemas/index.ts`
