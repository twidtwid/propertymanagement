# /backup

Create a full backup of the production database to local backups/ directory.

## Production Database
- **Container:** app-db-1
- **Database:** propertymanagement
- **User:** propman
- **Server:** 143.110.229.185

## What this skill does:
1. Creates a full pg_dump of the production database
2. Saves it to the local backups/ directory with timestamp
3. Verifies the backup file size and contents
4. Reports summary to user

## Steps to execute:

### Step 1: Create the backup
```bash
ssh root@143.110.229.185 "docker exec app-db-1 pg_dump -U propman -d propertymanagement --no-owner --no-acl" > backups/backup_full_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Verify the backup
```bash
ls -lah backups/backup_full_*.sql | tail -1
```

### Step 3: Check backup contents
```bash
# Count tables in backup
grep -c "^CREATE TABLE" backups/backup_full_*.sql | tail -1

# Show first few table names
grep "^CREATE TABLE" backups/backup_full_*.sql | tail -1 | head -10
```

## After backup:
Report to the user:
- Backup filename
- File size
- Number of tables included
- Location: backups/ directory

## Restore instructions (if user asks):
```bash
# Restore to local dev
docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement < backups/BACKUP_FILE.sql

# Restore to production (DANGEROUS - confirm with user first!)
ssh root@143.110.229.185 "docker exec -i app-db-1 psql -U propman -d propertymanagement" < backups/BACKUP_FILE.sql
```
