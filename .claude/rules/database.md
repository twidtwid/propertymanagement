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

### Vendor Specialties

30+ categories - when adding vendors, choose the most specific:
```
hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning,
pest_control, pool_spa, appliance, locksmith, alarm_security, snow_removal,
fuel_oil, property_management, architect, movers, trash, internet, phone,
water, septic, forester, fireplace, insurance, auto, elevator, flooring,
parking, masonry, other
```

## Key Tables

### Properties
- `span_number` - Vermont SPAN identifier
- `block_number`, `lot_number` - NYC identifiers
- `parcel_id` - Generic (used for CA APN)
- Properties link to: vehicles (none), vendors (via property_vendors), equipment, bills

### Vendors
- Many-to-many with properties via `property_vendors`
- `is_primary` flag indicates the go-to vendor for that specialty
- `specialty_override` allows different specialty per property

### Bills
- Can link to: property, vehicle, vendor (all optional)
- `days_to_confirm` default 14 - triggers alert for unconfirmed checks
- Status flow: pending → sent → confirmed (or overdue/cancelled)

### Property Taxes
- Separate table from bills for structured tracking
- Unique constraint: (property_id, tax_year, jurisdiction, installment)
- Installments: 1-4 for quarterly, 1-2 for semi-annual

### Vendor Communications
- Synced from Gmail via OAuth
- `gmail_message_id` is unique
- `direction`: inbound | outbound
- Matched to vendors via email/domain

## Relationships

```
properties ──< property_vendors >── vendors
properties ──< equipment
properties ──< bills
properties ──< property_taxes
properties ──< insurance_policies
properties ──< maintenance_tasks
properties ──< shared_task_lists ──< shared_task_items

vehicles ──< bills
vehicles ──< insurance_policies

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
Bills can have null property_id, vehicle_id, vendor_id - use LEFT JOIN when fetching:
```sql
SELECT b.*, p.name as property_name, v.name as vendor_name
FROM bills b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN vendors v ON b.vendor_id = v.id
```

## Indexes

Performance-critical indexes exist on:
- `bills(due_date)`, `bills(status)`
- `property_taxes(due_date)`
- `insurance_policies(expiration_date)`
- `maintenance_tasks(due_date)`
- `alerts(user_id, is_read)` - partial index where is_read = FALSE
