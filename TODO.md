# Expert Council Recommendations

Generated: 2026-01-02

## Immediate (This Week)

- [ ] **Verify session cookie signing** - Security risk: if cookies are unsigned, attackers could forge sessions with `role: owner`
- [ ] **Implement automated database backups** - Data loss risk: current manual `backups/` approach requires human intervention. Add cron job to upload to S3/DigitalOcean Spaces with 30-day retention
- [ ] **Add confirmation dialogs for cascade deletes** - Vendor deletion cascades to all email communications without warning. Add explicit confirmation stating consequences

## Short Term (This Month)

- [ ] **Add integration tests for mutations before refactoring** - Focus on: `createBill`, `updatePaymentStatus`, `confirmPayment`. Target 80% coverage on mutations.ts
- [ ] **Split actions.ts and mutations.ts into domain modules** - Create `src/lib/actions/properties.ts`, `actions/vendors.ts`, etc. Target ~300-400 lines per file
- [ ] **Implement RLS policies for bookkeeper role** - Add database-level enforcement as defense-in-depth. Bookkeeper restrictions currently app-layer only

## Medium Term (This Quarter)

- [ ] **Add monitoring and alerting stack** - Deploy Uptime Kuma or similar. Alert on: container restarts, disk >80%, DB connection failures, SSL expiry
- [ ] **Implement React cache() for query deduplication** - Wrap expensive database queries to deduplicate within single render pass
- [ ] **Enable stricter TypeScript compiler options** - Add `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` to tsconfig.json
- [ ] **Conduct accessibility audit** - Add keyboard navigation, focus management for dialogs, test with Tab key only
- [ ] **Add loading states for all Server Actions** - Every button should show spinner and be disabled during request

## Additional Recommendations by Expert

### Next.js/React Architect
- [ ] Add loading.tsx and error.tsx boundaries for major feature routes
- [ ] Use barrel exports from `actions/index.ts` for backward compatibility after split

### PostgreSQL DBA
- [ ] Add composite indexes: `idx_bills_property_status`, `idx_vendor_comms_vendor_date`
- [ ] Verify PgBouncer/connection pooling configured for Docker deployment
- [ ] Add `max_connections` monitoring to production alerts

### Security Engineer
- [ ] Add CSRF protection for all API routes (POST/PUT/DELETE)
- [ ] Set `SameSite=Strict` on session cookies
- [ ] Consider soft-delete for vendors instead of CASCADE DELETE (preserve audit trail)

### DevOps Engineer
- [ ] Create deployment runbook with rollback procedure
- [ ] Add Docker image versioning with tags (not `latest`)
- [ ] Test restore from backup quarterly

### TypeScript Lead
- [ ] Add branded types for IDs: `type PropertyId = string & { __brand: 'PropertyId' }`
- [ ] Use `@testing-library/react` for Server Action tests

### UX Designer
- [ ] Ensure AlertDialog components trap focus and return focus on close
- [ ] Add explicit consequences to confirmation dialogs (e.g., "This will delete 47 emails")
