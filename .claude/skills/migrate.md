# /migrate

Run database migrations on production.

## Production Database
- **Container:** app-db-1
- **Database:** propertymanagement
- **User:** propman
- **Server:** 143.110.229.185

## What this skill does:
1. Lists available migrations
2. Asks which migration(s) to run
3. Shows migration contents for review
4. Runs migration on production
5. Verifies success

## IMPORTANT SAFETY RULES:
- **Always show migration contents before running**
- **Recommend backup before destructive migrations (DROP, DELETE, ALTER)**
- **Run migrations one at a time unless user specifies otherwise**

## Steps to execute:

### Step 1: List available migrations
```bash
ls -la scripts/migrations/
```

### Step 2: Show migration contents
```bash
cat scripts/migrations/XXX_migration_name.sql
```

### Step 3: Confirm with user
Ask user to confirm they want to run this migration on production.

### Step 4: Run migration
```bash
ssh root@143.110.229.185 "docker exec -i app-db-1 psql -U propman -d propertymanagement" < scripts/migrations/XXX_migration_name.sql
```

### Step 5: Verify migration
Check that tables/columns were created:
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c \"\\dt\""
```

Or run a specific verification query based on the migration.

## Migration naming convention:
```
XXX_description.sql
```
Where XXX is a sequential number (002, 003, etc.)

## Current migrations applied to production:
| # | File | Description |
|---|------|-------------|
| 002 | 002_tax_lookup.sql | Tax lookup system |
| 003 | 003_seed_tax_configs.sql | Seed tax configs |
| 004 | 004_seed_property_taxes.sql | Seed property taxes |
| 005 | 005_audit_log.sql | Audit log table |
| 006 | 006_add_tax_lookup_url.sql | Tax lookup URL field |
| 007 | 007_property_visibility.sql | Property visibility |
| 008 | 008_dropbox_data.sql | Dropbox schema updates |
| 009 | 009_import_dropbox_data.sql | Import Dropbox data |
| 010 | 010_insurance_portfolio.sql | Insurance Portfolio + multi-asset policies |

## After running migration:
- Update this list in the skill file
- Update CLAUDE.md migrations table
- Report success/failure to user
