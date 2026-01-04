---
name: schema
description: Quick reference for database schema, tables, and relationships. Use when writing queries or understanding data model.
---

# Database Schema Reference

Quick reference for the PostgreSQL database schema.

## When to Use
- Writing SQL queries or migrations
- Adding features that touch the database
- Debugging data issues
- Understanding entity relationships

## Key Tables

### Core Entities
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| properties | Real estate | name, address, property_type, status, span_number, parcel_id, block_number, lot_number, square_feet, current_value |
| vehicles | Cars/trucks | name, make, model, year, vin, property_id |
| vendors | Service providers | name, specialty, phone, email, website, is_active |
| vendor_contacts | Multiple contacts per vendor | vendor_id, name, title, email, phone, is_primary |

### Property Tax Identifiers by Jurisdiction
| Jurisdiction | ID Fields Used |
|--------------|----------------|
| Vermont (Dummerston/Brattleboro) | span_number (e.g., 186-059-10695), parcel_id (e.g., 000453) |
| NYC | block_number, lot_number |
| Providence, RI | parcel_id (Plat-Lot-Unit format: 016-0200-0000) |
| Santa Clara, CA | parcel_id (APN format: 274-15-034) |

### Financial
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| bills | Payment entries | description, amount, due_date, status, payment_method, payment_date, confirmation_date |
| property_taxes | Tax payments | property_id, tax_year, jurisdiction, installment, amount, due_date |
| insurance_policies | Policies | carrier_name, policy_type, policy_number, premium_amount, expiration_date, coverage_details (JSONB) |
| insurance_claims | Claims | policy_id, claim_number, status, amount_claimed, amount_settled |

### Relationships
| Table | Purpose |
|-------|---------|
| property_vendors | Many-to-many: properties ↔ vendors (with is_primary, specialty_override) |
| property_visibility | Whitelist: which users see which properties |

### Operations
| Table | Purpose |
|-------|---------|
| maintenance_tasks | Task tracking with status, priority, due_date |
| equipment | Property equipment with purchase_date, warranty_expiration |
| shared_task_lists | Contractor task lists (links to properties) |
| shared_task_items | Items within task lists |
| seasonal_tasks | Seasonal maintenance items |

### Integrations
| Table | Purpose |
|-------|---------|
| vendor_communications | Gmail-synced emails (gmail_message_id, direction, matched_vendor_id) |
| dropbox_oauth_tokens | Encrypted tokens, namespace_id, root_folder_path |
| dropbox_folder_mappings | entity_type, entity_id → dropbox_folder_path, document_count |
| dropbox_file_summaries | file_path, content_hash, ai_summary, summarized_at |
| gmail_oauth_tokens | Encrypted Gmail tokens per user |
| buildinglink_messages | Building management messages with is_flagged |

### Tax Lookup
| Table | Purpose |
|-------|---------|
| tax_lookup_configs | Per-property lookup configuration (provider, identifiers) |
| tax_lookup_results | Synced tax data (assessed values, amounts, installments) |
| tax_sync_log | Audit log of sync attempts |

### System
| Table | Purpose |
|-------|---------|
| profiles | Users with role (owner/bookkeeper), email, name |
| alerts | User notifications (severity, related_table, related_id, is_read) |
| user_audit_log | Action audit trail (action, entity_type, entity_id, changes JSONB) |
| notification_log | Email tracking |

## Key Enums

### vendor_specialty (31 values)
```
hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning,
pest_control, pool_spa, appliance, locksmith, alarm_security, snow_removal,
fuel_oil, property_management, architect, movers, trash, internet, phone,
water, septic, forester, fireplace, insurance, auto, elevator, flooring,
parking, masonry, audiovisual, other
```

### payment_status
```
pending → sent → confirmed | overdue | cancelled
```

### bill_type
```
property_tax, insurance, utility, maintenance, mortgage, hoa, other
```

### insurance_type
```
homeowners, auto, umbrella, flood, earthquake, liability, health, travel, other
```

### user_role
```
owner, bookkeeper
```

## Common Queries

### Get vendor with primary contact
```sql
SELECT v.*, vc.name as contact_name, vc.email as contact_email, vc.phone as contact_phone
FROM vendors v
LEFT JOIN vendor_contacts vc ON v.id = vc.vendor_id AND vc.is_primary = true
WHERE v.id = $1
```

### Get insurance with property/vehicle
```sql
SELECT ip.*, p.name as property_name,
       CONCAT(vh.year, ' ', vh.make, ' ', vh.model) as vehicle_name
FROM insurance_policies ip
LEFT JOIN properties p ON ip.property_id = p.id
LEFT JOIN vehicles vh ON ip.vehicle_id = vh.id
WHERE ip.id = $1
```

### Get Dropbox folder for entity
```sql
SELECT dropbox_folder_path, document_count
FROM dropbox_folder_mappings
WHERE entity_type = $1 AND entity_id = $2 AND is_active = true
```

### Get property taxes with property name
```sql
SELECT pt.*, p.name as property_name, p.span_number, p.parcel_id
FROM property_taxes pt
JOIN properties p ON pt.property_id = p.id
WHERE pt.tax_year = $1
ORDER BY pt.jurisdiction, p.name, pt.installment
```

### Get all property identifiers
```sql
SELECT name, city, state, span_number, parcel_id, block_number, lot_number, current_value
FROM properties
WHERE status = 'active'
ORDER BY state, city
```

## Schema File Locations
- Full schema: `scripts/init.sql`
- Migrations: `scripts/migrations/*.sql` (002-025)
- Types: `src/types/database.ts`
- Zod schemas: `src/lib/schemas/index.ts`

## Quick Commands

### List all tables
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c '\\dt'"
```

### Describe a table
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c '\\d tablename'"
```

### Check enum values
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c \"SELECT enum_range(NULL::vendor_specialty)\""
```

### Run a query
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c 'SELECT COUNT(*) FROM vendors'"
```
