/**
 * Actions Barrel Export
 *
 * Phase 3 infrastructure setup: Domain-based module organization.
 *
 * CURRENT STATE:
 * - Domain modules created as templates (properties.ts, vehicles.ts)
 * - All functions still in monolithic ../actions.ts
 * - This barrel file maintains backward compatibility
 *
 * FUTURE MIGRATION PLAN:
 * For each domain module:
 * 1. Move functions from ../actions.ts to domain file
 * 2. Remove moved functions from ../actions.ts
 * 3. Update this file to import from domain module
 * 4. Test thoroughly before moving to next domain
 *
 * TARGET STRUCTURE:
 * - properties.ts (3 functions)
 * - vehicles.ts (3 functions)
 * - vendors.ts (10+ functions)
 * - bills.ts (4+ functions)
 * - taxes.ts (8+ functions)
 * - insurance.ts (8+ functions)
 * - payments.ts (3+ functions)
 * - maintenance.ts (5+ functions)
 * - tickets.ts (5+ functions)
 * - pinning.ts (10+ functions)
 * - dashboard.ts (5+ functions)
 * - reports.ts (10+ functions)
 */

// Domain-based exports (Phase 3A, 3B & 3C migration complete)
export * from "./properties"
export * from "./vehicles"
export * from "./bills"
export * from "./vendors"
export * from "./insurance"
export * from "./taxes"
export * from "./payments"
export * from "./pinning"
export * from "./dashboard"
export * from "./maintenance"
export * from "./tickets"
export * from "./reports"
export * from "./buildinglink"
export * from "./calendar"
export * from "./property-access"

// Re-export remaining functions from monolithic file (now renamed to actions-remaining.ts)
// (will be migrated incrementally in Phase 3D+)
export * from "../actions-remaining"
