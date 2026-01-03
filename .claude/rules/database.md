# Database Schema Rules

## Enum Types

All enums are defined in PostgreSQL and mirrored in `src/types/database.ts`.

### Core Enums

```
user_role: owner | bookkeeper
property_type: house | condo | land | other
property_status: active | inactive | sold
payment_status: pending | sent | confirmed | overdue | cancelled
payment_method: check | auto_pay | online | wire | cash | other
bill_type: property_tax | insurance | utility | maintenance | mortgage | hoa | other
recurrence: one_time | monthly | quarterly | semi_annual | annual
task_status: pending | in_progress | completed | cancelled
task_priority: low | medium | high | urgent
insurance_type: homeowners | auto | umbrella | flood | earthquake | liability | health | travel | other
claim_status: filed | in_progress | approved | denied | settled
season: winter | spring | summer | fall | annual
alert_severity: info | warning | critical
```

### Vendor Specialties (31 values)

When adding vendors, choose the most specific category:
```
hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning,
pest_control, pool_spa, appliance, locksmith, alarm_security, snow_removal,
fuel_oil, property_management, architect, movers, trash, internet, phone,
water, septic, forester, fireplace, insurance, auto, elevator, flooring,
parking, masonry, audiovisual, other
```

## Key Tables

### Properties
- `span_number` - Vermont SPAN identifier
- `block_number`, `lot_number` - NYC identifiers
- `parcel_id` - Generic (used for CA APN)
- Links to: vendors (via property_vendors), equipment, bills, insurance_policies

### Vehicles
- `property_id` - Optional link to property (inherits visibility)
- Links to: bills, insurance_policies

### Vendors
- Many-to-many with properties via `property_vendors`
- `is_primary` flag indicates go-to vendor for specialty
- `specialty_override` allows different specialty per property

### Vendor Contacts
- Multiple contacts per vendor via `vendor_id` FK
- Fields: name, title, email, phone, notes, is_primary
- Partial unique index ensures only one `is_primary` per vendor
- Primary contact shown in vendor header

### Bills
- Can link to: property, vehicle, vendor (all optional)
- `days_to_confirm` default 14 - triggers alert for unconfirmed checks
- Status flow: pending → sent → confirmed (or overdue/cancelled)

### Property Taxes
- Separate table from bills for structured tracking
- Unique constraint: (property_id, tax_year, jurisdiction, installment)
- Installments: 1-4 for quarterly, 1-2 for semi-annual

### Insurance Policies
- `coverage_details` JSONB field for line-item coverage
- Links to property OR vehicle (not both)
- Berkley One covers multiple entities as portfolio carrier

### Dropbox Integration
- `dropbox_oauth_tokens` - Encrypted tokens, namespace_id for shared folders
- `dropbox_folder_mappings` - Entity type/id → folder path mappings
- `dropbox_file_summaries` - AI-generated summaries by file path

### Vendor Communications
- Synced from Gmail via OAuth
- `gmail_message_id` is unique
- `direction`: inbound | outbound
- Matched to vendors via email/domain
- CASCADE DELETE: deleting vendor deletes all linked emails

### Pinned Items
- Polymorphic table supporting 8 entity types (vendor, bill, ticket, etc.)
- Two types: smart pins (`is_system_pin = true`) and user pins (`is_system_pin = false`)
- Smart pins can be dismissed (`dismissed_at`), user pins are deleted
- Metadata cached in JSONB to avoid joins (title, amount, due_date, etc.)
- UNIQUE constraint on (entity_type, entity_id) - one pin per item
- All pins are shared across all users (family-wide)

## Relationships

```
properties ──< property_vendors >── vendors
properties ──< property_visibility >── profiles
properties ──< equipment
properties ──< bills
properties ──< property_taxes
properties ──< insurance_policies
properties ──< maintenance_tasks
properties ──< shared_task_lists ──< shared_task_items
properties ──< dropbox_folder_mappings

vehicles ──< bills
vehicles ──< insurance_policies
vehicles ──< dropbox_folder_mappings

vendors ──< vendor_contacts
vendors ──< bills
vendors ──< vendor_communications

insurance_policies ──< insurance_claims
```

## Query Patterns

### Integer Casting for Date Arithmetic
```sql
-- WRONG: "operator is not unique" error
WHERE due_date <= CURRENT_DATE + $1

-- CORRECT: explicit cast
WHERE due_date <= CURRENT_DATE + ($1::INTEGER)
```

### UUID Generation
```sql
-- Use gen_random_uuid() (built-in), not uuid_generate_v4() (requires extension)
INSERT INTO properties (id, name) VALUES (gen_random_uuid(), 'Test')
```

### Joins with Optional Relations
Bills can have null property_id, vehicle_id, vendor_id - use LEFT JOIN:
```sql
SELECT b.*, p.name as property_name, v.name as vendor_name
FROM bills b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN vendors v ON b.vendor_id = v.id
```

### Vendor with Primary Contact
```sql
SELECT v.*, vc.name as primary_contact_name, vc.email as primary_contact_email
FROM vendors v
LEFT JOIN vendor_contacts vc ON v.id = vc.vendor_id AND vc.is_primary = true
```

## Indexes

Performance-critical indexes exist on:
- `bills(due_date)`, `bills(status)`
- `property_taxes(due_date)`
- `insurance_policies(expiration_date)`
- `maintenance_tasks(due_date)`
- `alerts(user_id, is_read)` - partial index where is_read = FALSE
- `vendor_contacts(vendor_id, is_primary)` - partial unique where is_primary = TRUE
- `dropbox_file_summaries(file_path)` - for lookup by path
- `pinned_items(entity_type, entity_id)` - unique constraint index
- `pinned_items(entity_type, is_system_pin, dismissed_at)` - smart pins hot path (3x faster)
- `pinned_items(dismissed_at)` - partial index for analytics, where dismissed_at IS NOT NULL
