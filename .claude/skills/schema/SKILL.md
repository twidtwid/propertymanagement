---
name: schema
description: Quick reference for database schema, tables, and relationships. Use when writing queries or understanding data model.
---

# Database Schema Reference Skill

Quick reference for the PostgreSQL database schema.

## When to Use
- When writing SQL queries
- When adding new features that touch the database
- When debugging data issues
- When creating migrations

## Key Tables

### Core Entities
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| properties | Real estate | name, address, property_type, status |
| vehicles | Cars/trucks | name, make, model, year, property_id |
| vendors | Service providers | name, specialty, phone, email, is_active |
| vendor_contacts | Multiple contacts per vendor | name, title, email, phone, is_primary |

### Financial
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| bills | Payment entries | description, amount, due_date, status, payment_method |
| property_taxes | Tax payments | property_id, tax_year, jurisdiction, installment, amount |
| insurance_policies | Policies | carrier_name, policy_type, premium, expiration_date |
| insurance_claims | Claims | policy_id, claim_number, status, amount_claimed |

### Relationships
| Table | Purpose |
|-------|---------|
| property_vendors | Many-to-many: properties ↔ vendors |
| property_visibility | Whitelist: which users see which properties |

### Operations
| Table | Purpose |
|-------|---------|
| maintenance_tasks | Task tracking with status, priority |
| equipment | Property equipment with warranty dates |
| shared_task_lists | Contractor task lists |
| seasonal_tasks | Seasonal maintenance items |

### Integrations
| Table | Purpose |
|-------|---------|
| vendor_communications | Gmail-synced emails |
| dropbox_file_summaries | AI document summaries |
| dropbox_folder_mappings | Property/vehicle → Dropbox paths |

### System
| Table | Purpose |
|-------|---------|
| profiles | Users with role (owner/bookkeeper) |
| alerts | User notifications |
| user_audit_log | Action audit trail |
| notification_log | Email tracking |

## Key Enums

### vendor_specialty (31 values)
hvac, plumbing, electrical, roofing, general_contractor, landscaping, cleaning, pest_control, pool_spa, appliance, locksmith, alarm_security, snow_removal, fuel_oil, property_management, architect, movers, trash, internet, phone, water, septic, forester, fireplace, insurance, auto, elevator, flooring, parking, masonry, audiovisual, other

### payment_status
pending → sent → confirmed | overdue | cancelled

### bill_type
property_tax, insurance, utility, maintenance, mortgage, hoa, other

### insurance_type
homeowners, auto, umbrella, flood, earthquake, liability, health, travel, other

## Schema File Location
Full schema: `scripts/init.sql` (937 lines)
Migrations: `scripts/migrations/*.sql`

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
