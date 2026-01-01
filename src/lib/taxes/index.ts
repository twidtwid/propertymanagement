/**
 * Property Tax Lookup System
 *
 * Provides automated tax lookups from various government data sources:
 * - NYC Open Data API (Brooklyn)
 * - Santa Clara County (San Jose) - requires Playwright
 * - City Hall Systems (Providence)
 * - Vermont NEMRC Database
 *
 * Architecture:
 * 1. Web app sync (NYC): Direct API calls via /api/cron/sync-taxes
 * 2. External scrapers (SCC, Providence, Vermont): Python/Playwright scripts
 *    that POST results to /api/taxes/sync/callback
 * 3. Results stored in tax_lookup_results AND property_taxes tables
 * 4. property_taxes table feeds calendar and payments UI
 */

export * from './types'
export * from './sync'
export * from './sync-to-payments'
export * from './providers/nyc-open-data'
export * from './providers/santa-clara-county'
