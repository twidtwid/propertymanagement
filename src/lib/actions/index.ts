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

// For now, re-export everything from the monolithic file
// This maintains 100% backward compatibility
export * from "../actions"

// When ready to migrate a domain:
// 1. Uncomment the domain export below
// 2. Remove those functions from ../actions.ts
// 3. Test thoroughly

// export * from "./properties"
// export * from "./vehicles"
// export * from "./vendors"
// ... etc
