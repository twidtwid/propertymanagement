---
paths: scripts/init.sql, scripts/migrations/*, src/types/database.ts, src/lib/schemas/index.ts
---

# Database Reference

**CRITICAL:** Sync enums in BOTH `scripts/init.sql` AND `src/lib/schemas/index.ts`

## Key Enums

```sql
user_role: owner | bookkeeper
payment_status: pending | sent | confirmed | overdue | cancelled
payment_method: check | auto_pay | online | wire | cash | other
bill_type: property_tax | insurance | utility | maintenance | mortgage | hoa | other
task_status: pending | in_progress | completed | cancelled
task_priority: low | medium | high | urgent
```

## Property Identifiers

| State | Field |
|-------|-------|
| Vermont | `span_number` (186-059-10695) |
| NYC | `block_number`, `lot_number` |
| CA/RI | `parcel_id` |

## SQL Patterns

```sql
-- Date arithmetic (ALWAYS cast)
WHERE due_date <= CURRENT_DATE + ($1::INTEGER)

-- Optional FKs use LEFT JOIN
SELECT b.*, p.name FROM bills b LEFT JOIN properties p ON b.property_id = p.id

-- Use gen_random_uuid() not uuid_generate_v4()
```

## Migration Workflow

1. Create `scripts/migrations/NNNN_description.sql`
2. Update `src/types/database.ts`
3. Update `src/lib/schemas/index.ts` (if enum)
4. Run `/migrate <filename>`
5. Run `/build`

## Type Flow

`init.sql` → `database.ts` → `schemas/index.ts` → Server Actions
