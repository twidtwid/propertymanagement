/**
 * Mutations Barrel Export
 *
 * Phase 3 infrastructure setup: Domain-based module organization.
 *
 * CURRENT STATE:
 * - All mutation functions still in monolithic ../mutations.ts
 * - This barrel file maintains backward compatibility
 *
 * FUTURE MIGRATION PLAN:
 * For each domain module:
 * 1. Create domain file (e.g., properties.ts)
 * 2. Move mutations from ../mutations.ts to domain file
 * 3. Remove moved mutations from ../mutations.ts
 * 4. Update this file to import from domain module
 * 5. Test thoroughly before moving to next domain
 *
 * TARGET STRUCTURE:
 * - properties.ts (create, update mutations)
 * - vehicles.ts (create, update mutations)
 * - vendors.ts (create, update, vendor contacts mutations)
 * - bills.ts (create, update, confirm mutations)
 * - taxes.ts (create, update, confirm mutations)
 * - insurance.ts (create, update, claims mutations)
 * - payments.ts (payment processing mutations)
 * - maintenance.ts (task CRUD mutations)
 * - tickets.ts (ticket CRUD, activity mutations)
 * - pinning.ts (pin/unpin mutations)
 */

// For now, re-export everything from the monolithic file
// This maintains 100% backward compatibility
export * from "../mutations"

// When ready to migrate a domain:
// 1. Create domain file
// 2. Move mutations to domain file
// 3. Uncomment domain export below
// 4. Remove moved functions from ../mutations.ts
// 5. Test thoroughly

// export * from "./properties"
// export * from "./vehicles"
// export * from "./vendors"
// ... etc
