# Phase 3: Reduce Complexity - INFRASTRUCTURE COMPLETE

**Date:** 2026-01-11
**Status:** 🏗️ Infrastructure ready, migration in progress
**Time:** ~1 hour for setup

## Summary

Phase 3 goal is to split monolithic files (actions.ts: 4,895 lines, mutations.ts: 2,504 lines) into domain-based modules. **Phase 3A complete:** Properties, vehicles, and bills domains migrated successfully with 100% backward compatibility maintained.

---

## ✅ Completed This Session

### 1. Lint Errors Fixed
**All 8 ESLint errors resolved:**
- ✅ unified-pinned-items.tsx (2 errors - unescaped quotes)
- ✅ file-browser.tsx (2 errors - unescaped quotes)
- ✅ smart-pins-settings.tsx (3 errors - unescaped apostrophes)
- ✅ dropbox/sync.ts (1 error - undefined rule)

**Result:** Zero errors, only warnings remain (pre-existing, non-blocking)

### 2. Domain Module Infrastructure

#### Created Directory Structure
```
src/lib/
  actions/
    index.ts          # Barrel export (maintains compatibility)
  mutations/
    index.ts          # Barrel export (maintains compatibility)
```

**Note:** Template files initially created were removed to avoid TypeScript errors. Domain modules will be created during actual migration with correct implementation patterns.

#### Barrel Exports Pattern
Both `actions/index.ts` and `mutations/index.ts` currently re-export from monolithic files:
```typescript
// For now, re-export everything from the monolithic file
export * from "../actions"  // or "../mutations"

// When ready to migrate a domain:
// 1. Move functions to domain file
// 2. Remove from monolithic file
// 3. Uncomment domain export
// 4. Test thoroughly
```

**Benefits:**
- ✅ 100% backward compatibility (no breaking changes)
- ✅ Clear migration path documented
- ✅ Template modules demonstrate the pattern
- ✅ Can migrate domains incrementally

---

## 📊 Phase 3 Scope Analysis

### actions.ts (4,895 lines, 108 functions)

**Domain Breakdown:**
| Domain | Functions | Lines (est) | Priority |
|--------|-----------|-------------|----------|
| Pinning System | ~15 | ~1,000 | High |
| Reports | ~15 | ~800 | Medium |
| Dashboard | ~10 | ~600 | High |
| Vendors | ~10 | ~400 | High |
| Insurance | ~8 | ~350 | Medium |
| Property Taxes | ~8 | ~350 | Medium |
| Tickets | ~5 | ~300 | Medium |
| Maintenance | ~5 | ~250 | Low |
| Payments | ~5 | ~250 | Medium |
| Bills | ~4 | ~200 | Medium |
| Vehicles | ~3 | ~150 | Low |
| Properties | ~3 | ~150 | Low |
| Search | ~2 | ~150 | Low |
| Misc | ~15 | ~500 | Low |

**Migration Strategy:**
1. Start with small, self-contained domains (properties, vehicles, bills)
2. Move to medium complexity (vendors, insurance, taxes)
3. Tackle complex domains last (pinning, dashboard, reports)

### mutations.ts (2,504 lines, 58 functions)

**Domain Breakdown:**
| Domain | Functions | Lines (est) | Priority |
|--------|-----------|-------------|----------|
| Bills | ~8 | ~400 | Medium |
| Tickets | ~6 | ~350 | Medium |
| Property Taxes | ~5 | ~300 | Medium |
| Insurance | ~5 | ~300 | Medium |
| Vendors | ~5 | ~250 | High |
| Maintenance | ~4 | ~200 | Low |
| Vehicles | ~3 | ~200 | Low |
| Properties | ~3 | ~200 | Low |
| Pinning | ~3 | ~150 | High |
| Misc | ~16 | ~650 | Medium |

---

## 🎯 Migration Roadmap

### Phase 3A: Small Domains ✅ **COMPLETE**
**Goal:** Migrate 3 simple domains to validate pattern

1. ✅ **Properties** (3 functions, 39 lines)
   - getProperties()
   - getProperty()
   - getActiveProperties()

2. ✅ **Vehicles** (3 functions, 38 lines)
   - getVehicles()
   - getVehicle()
   - getActiveVehicles()

3. ✅ **Bills** (3 functions, 47 lines)
   - getBills()
   - getUpcomingBills()
   - getBillsNeedingConfirmation()

**Deliverables:** ✅ All Complete
- ✅ Moved functions from actions.ts to domain modules
- ✅ Removed moved functions from actions.ts (now actions-remaining.ts)
- ✅ Updated barrel exports (actions/index.ts)
- ✅ Full test suite passes (8/8)
- ✅ TypeScript validation passes
- ✅ Lint: 0 errors (warnings only)

**Key Learning:** File vs directory precedence issue - renamed actions.ts to actions-remaining.ts to allow barrel export to work correctly.

### Phase 3B: Medium Domains ✅ **COMPLETE**
**Goal:** Migrate core business logic domains

1. ✅ **Vendors** (12 functions, ~450 lines)
   - getVendors(), getVendor(), getVendorWithLocations()
   - getVendorContacts(), getPrimaryVendorContact()
   - getVendorCommunications(), etc.

2. ✅ **Insurance** (10 functions, ~375 lines)
   - getInsurancePolicies(), getInsurancePolicy()
   - getPropertyInsurance(), getVehicleInsurance()
   - getExpiringPolicies(), getInsuranceClaims(), etc.

3. ✅ **Property Taxes** (8 functions, ~320 lines)
   - getPropertyTaxes(), getPropertyTax()
   - getTaxesByProperty(), getUpcomingTaxes()
   - getTaxLookupConfigs(), getTaxSyncLog(), etc.

4. ✅ **Payments** (5 functions, ~374 lines)
   - getAllPayments(), getBillsForPayments()
   - getTaxesForPayments(), getInsurancePremiumsForPayments()
   - getPaymentSuggestions()

**Deliverables:** ✅ All Complete
- ✅ Created 4 domain modules with proper typing
- ✅ Updated barrel exports
- ✅ Removed migrated code from actions-remaining.ts
- ✅ TypeScript validation passes
- ✅ All tests passing (8/8)

### Phase 3C: Complex Domains ✅ **COMPLETE**
**Goal:** Migrate large, interconnected domains

1. ✅ **Pinning System** (17 functions, ~1,095 lines)
   - getPinnedIds(), getSmartAndUserPins()
   - upsertSmartPin(), removeSmartPin(), togglePin()
   - getAllPinnedItems(), getDashboardPinnedItems()
   - syncSmartPinsBills(), syncSmartPinsTickets()
   - syncSmartPinsBuildingLink(), syncSmartPinsWeather()
   - syncAllSmartPins(), getPinNotes(), etc.

2. ✅ **Dashboard** (6 functions, ~358 lines)
   - getUpcomingWeek(), getNewDashboardStats()
   - getRecentCommunications(), getUnmatchedCommunications()
   - getCommunicationStats(), getDashboardStats()

3. ✅ **Maintenance** (6 functions, ~120 lines)
   - getMaintenanceTasks(), getPendingMaintenanceTasks()
   - getUrgentTasks(), getSharedTaskLists()
   - getSharedTaskListWithItems(), getSharedTaskListsForProperty()

4. ✅ **Tickets** (6 functions + interfaces, ~356 lines)
   - getTickets(), getTicket(), getTicketActivity()
   - getTicketsForProperty(), getOpenTicketCount()
   - globalSearch() (cross-entity search)

5. ✅ **Reports** (10 functions + interfaces, ~817 lines)
   - getPaymentSummaryReport(), getPropertyValuesReport()
   - getTaxCalendarReport(), getMaintenanceCostsReport()
   - getInsuranceCoverageReport(), getYearEndExportData()
   - getVendorReport(), getTicketReport(), getWeeklyTicketReport()

**Deliverables:** ✅ All Complete
- ✅ Created 5 complex domain modules with full typing
- ✅ Migrated 45+ functions and numerous interfaces
- ✅ Updated barrel exports
- ✅ Removed migrated code from actions-remaining.ts (~2,000 lines removed)
- ✅ TypeScript validation passes
- ✅ All tests passing (8/8)

### Phase 3D: Remaining Domains (Week 3 - 3 hours)
**Goal:** Complete migration

1. ⏳ **Tickets** (5 functions, ~300 lines)
2. ⏳ **Maintenance** (5 functions, ~250 lines)
3. ⏳ **Search & Misc** (~10 functions, ~400 lines)

---

## 📁 Template: Domain Module Pattern

### Example: src/lib/actions/properties.ts
```typescript
/**
 * Property-related query functions
 *
 * Extracted from monolithic actions.ts as part of Phase 3 refactoring.
 * All property CRUD operations and queries.
 */

import { query, queryOne } from "../db"
import { getVisibilityContext, filterByVisibility } from "../visibility"
import type { Property } from "@/types/database"

export async function getProperties(): Promise<Property[]> {
  const properties = await query<Property>("SELECT * FROM properties ORDER BY name")
  return filterByVisibility(properties)
}

export async function getProperty(id: string): Promise<Property | null> {
  const property = await queryOne<Property>(
    "SELECT * FROM properties WHERE id = $1",
    [id]
  )
  const filtered = await filterByVisibility([property].filter(Boolean))
  return filtered[0] || null
}

export async function getActiveProperties(): Promise<Property[]> {
  const properties = await query<Property>(
    "SELECT * FROM properties WHERE status = 'active' ORDER BY name"
  )
  return filterByVisibility(properties)
}
```

### Key Principles
1. **One file per domain** - Clear responsibility boundaries
2. **Import shared utilities** - Don't duplicate code
3. **Preserve types** - Use existing types from @/types/database
4. **Document context** - Note extraction from monolithic file
5. **Test after move** - Verify all imports work

---

## 🔄 Migration Checklist

For each domain migration:

- [ ] **1. Create domain file** (e.g., `src/lib/actions/vendors.ts`)
- [ ] **2. Copy functions** from monolithic file to domain file
- [ ] **3. Update imports** in domain file (db, visibility, types)
- [ ] **4. Add JSDoc** explaining extraction
- [ ] **5. Export from barrel** (`src/lib/actions/index.ts`)
- [ ] **6. Remove from monolithic** file
- [ ] **7. Run TypeScript** validation (`npx tsc --noEmit`)
- [ ] **8. Run tests** (`npm run test:run`)
- [ ] **9. Commit** with descriptive message
- [ ] **10. Test in browser** - Verify UI still works

---

## ⚠️ Risks & Mitigation

### Risk: Breaking imports in 400+ files
**Mitigation:** Barrel exports maintain backward compatibility. All existing imports continue to work.

### Risk: Circular dependencies
**Mitigation:** Domain modules only import shared utilities (db, visibility), never other domains.

### Risk: Missing functions during migration
**Mitigation:** Run TypeScript validation after each domain. Compiler will catch missing exports immediately.

### Risk: Test failures after migration
**Mitigation:** Run full test suite after each domain. Revert if any tests fail.

---

## 📈 Progress Tracking

### Overall Phase 3 Progress: 65% Complete

| Category | Total Lines | Migrated | Remaining | % Complete |
|----------|------------|----------|-----------|------------|
| actions.ts | 4,895 | ~3,200 | ~1,695 | ~65% |
| mutations.ts | 2,504 | 0 | 2,504 | 0% |
| **Total** | **7,399** | **~3,200** | **~4,199** | **~43%** |

**Infrastructure:** ✅ Complete (directories, barrel exports, documentation)
**Phase 3A:** ✅ Complete (properties, vehicles, bills domains - 3 functions, 124 lines)
**Phase 3B:** ✅ Complete (vendors, insurance, taxes, payments - 35 functions, ~1,519 lines)
**Phase 3C:** ✅ Complete (pinning, dashboard, maintenance, tickets, reports - 45 functions, ~2,746 lines)
**Phase 3D:** ⏳ Remaining domains (BuildingLink, calendar, property access, etc.)

### Estimated Completion
- **Phase 3A (Small domains):** Next session (2 hours)
- **Phase 3B (Medium domains):** Week 2 (4 hours)
- **Phase 3C (Complex domains):** Week 2-3 (6 hours)
- **Phase 3D (Remaining):** Week 3 (3 hours)

**Total estimated time:** 15 hours across 2-3 weeks

---

## 🎓 Lessons Learned

### What Worked
✅ Creating infrastructure first prevents breaking changes
✅ Template modules demonstrate pattern clearly
✅ Barrel exports enable incremental migration
✅ Documenting domain breakdown reveals scope

### Challenges
⚠️ Scope is larger than initially estimated (7,400 lines!)
⚠️ Some domains are highly interconnected (pinning, dashboard)
⚠️ Need careful testing after each migration

### Recommendations
- Migrate small domains first to validate pattern
- Commit after each domain (not in batches)
- Run full test suite + manual UI testing
- Consider pairing complex domains (pinning + dashboard together)

---

## 🚀 Next Steps

**Phase 3A Complete!** ✅

**Next Session (Phase 3B - Estimated 4 hours):**
1. Migrate vendors domain (~10 functions, ~400 lines)
2. Migrate insurance domain (~8 functions, ~350 lines)
3. Migrate property taxes domain (~8 functions, ~350 lines)
4. Migrate payments domain (~5 functions, ~250 lines)
5. Verify all tests pass after each domain
6. Commit incrementally

**This Week:**
- Complete Phase 3B (medium domains)
- Begin Phase 3C (complex domains: pinning, dashboard, reports)

**Next 2-3 Weeks:**
- Complete full migration
- Verify no monolithic files remain >800 lines
- Update all documentation
- Celebrate! 🎉

---

## Success Metrics

**Phase 3 Goals:**
- ✅ Infrastructure created
- ⏳ Largest file <800 lines (current: actions.ts at 4,895 lines)
- ⏳ Clear domain boundaries
- ⏳ Easier to navigate codebase
- ⏳ Reduced merge conflicts
- ⏳ Faster file loads in editor

**Phase 3 is 10% complete!** Infrastructure is ready, migration can begin incrementally with confidence.
