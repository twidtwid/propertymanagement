# /prod-db

Run SQL queries against the production database.

## Production Database
- **Container:** app-db-1
- **Database:** propertymanagement
- **User:** propman
- **Server:** 143.110.229.185

## What this skill does:
1. Connects to the production PostgreSQL database
2. Runs queries as requested by the user
3. Returns results

## IMPORTANT SAFETY RULES:
- **READ queries are safe** - SELECT, EXPLAIN, etc.
- **WRITE queries require explicit user confirmation** - INSERT, UPDATE, DELETE, ALTER, DROP
- **Always show the query to the user before running writes**
- **For destructive operations, suggest making a backup first**

## Steps to execute:

### For SELECT queries:
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement -c \"YOUR_QUERY_HERE\""
```

### For multi-line or complex queries:
```bash
ssh root@143.110.229.185 "docker exec app-db-1 psql -U propman -d propertymanagement" << 'EOF'
YOUR
MULTI
LINE
QUERY
HERE;
EOF
```

## Common queries:

### Check table counts
```sql
SELECT 'properties' as table_name, count(*) FROM properties
UNION ALL SELECT 'vehicles', count(*) FROM vehicles
UNION ALL SELECT 'vendors', count(*) FROM vendors
UNION ALL SELECT 'bills', count(*) FROM bills
UNION ALL SELECT 'insurance_policies', count(*) FROM insurance_policies
UNION ALL SELECT 'vendor_communications', count(*) FROM vendor_communications;
```

### Recent audit log
```sql
SELECT created_at, action, entity_type, entity_name, user_email
FROM user_audit_log
ORDER BY created_at DESC
LIMIT 20;
```

### Check for pending payments
```sql
SELECT description, amount, due_date, status
FROM bills
WHERE status = 'pending'
ORDER BY due_date;
```

### Insurance policies expiring soon
```sql
SELECT carrier_name, policy_type, expiration_date,
       expiration_date - CURRENT_DATE as days_until
FROM insurance_policies
WHERE expiration_date > CURRENT_DATE
ORDER BY expiration_date
LIMIT 10;
```

## Interactive shell (tell user to run themselves):
```bash
ssh root@143.110.229.185 "docker exec -it app-db-1 psql -U propman -d propertymanagement"
```
