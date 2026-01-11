# Unused Exports Report

**Generated:** 2026-01-11
**Tool:** ts-prune

This report identifies potentially unused exports. Review carefully before removing - some may be:
- Used dynamically
- Part of public API
- Planned for future use
- Used in ways ts-prune can't detect

## Confirmed Unused (Safe to Remove)

These have been verified as genuinely unused:

### src/lib/actions.ts
- `getActiveVendors` (line 134) - Never called
- `getVendorsBySpecialty` (line 144) - Never called
- `getStarredVendorIds` (line 327) - Old vendor starring, replaced by pinning
- `toggleVendorStar` (line 336) - Old vendor starring, replaced by pinning

### src/lib/mutations.ts
- `deleteProperty` (line 187) - Never implemented in UI
- `deleteVehicle` (line 620) - Never implemented in UI
- `deleteBill` (line 953) - Never implemented in UI

### src/lib/calendar-utils.ts
- `WEEKDAY_NAMES_FULL` (line 135) - Unused constant
- `HOURS` (line 145) - Unused constant

### src/lib/encryption.ts
- `generateEncryptionKey` (line 69) - Helper, not used in app

### src/lib/daily-summary.ts
- `generateSubjectLine` (line 564) - Unused helper

## Review Required (Potentially Used)

These need careful verification before removal:

### src/lib/actions.ts - Query Functions
Many query functions appear unused but may be called from:
- API routes
- Background workers
- External scripts

Examples needing review:
- `getAllPinnedItems` (line 630)
- `getNewDashboardStats` (line 1682)
- `getRecentCommunications` (line 1723)
- `getBills` (line 1801)
- `getUpcomingBills` (line 1811)
- `getBillsNeedingConfirmation` (line 1824)
- `getPropertyTaxes` (line 1838)
- `getUpcomingPropertyTaxes` (line 1941)
- `getInsurancePolicies` (line 1986)
- `getMaintenanceTasks` (line 2423)
- `getPendingMaintenanceTasks` (line 2440)
- `getUrgentTasks` (line 2458)
- `getSharedTaskLists` (line 2476)
- `getOpenTicketCount` (line 2664)
- `getDashboardStats` (line 2770)

### src/lib/api-auth.ts - Middleware
- `withCronAuth` (line 77) - May be used in API routes
- `isOwner` (line 117) - May be used in API routes
- `requireOwnerRole` (line 126) - May be used in API routes

### src/lib/api-error.ts - Error Handling
- `apiSuccess` (line 71) - May be used in API routes
- `withErrorHandler` (line 82) - May be used in API routes

### src/lib/auth.ts - Auth Functions
- `requireOwner` (line 42) - May be used in protected routes
- `login` (line 162) - May be used in auth flow
- `logout` (line 167) - May be used in auth flow

### src/lib/mutations.ts - Update Functions
- `updateBill` (line 702) - May be used in payment flows

## Removal Strategy

1. **Phase 1 (Now):** Remove confirmed unused exports listed above
2. **Phase 2 (Future):** Audit "Review Required" section during monolithic file splitting
3. **Phase 3 (Future):** Consider making some functions internal (not exported)

## Notes

- Old vendor starring system (star icon) was replaced by pinning system
- Delete operations may have been intentionally left unimplemented for safety
- Many query functions may be legitimate candidates for removal during Phase 3 refactoring
