/**
 * Santa Clara County Property Tax Lookup
 *
 * Data source: Santa Clara County Tax Collector
 * URL: https://payments.sccgov.org/propertytax
 *
 * This requires browser automation (Playwright) because the site
 * uses dynamic JavaScript and doesn't have a public API.
 *
 * For production use, run the Playwright script externally and
 * POST results to the API endpoint.
 */

import type { TaxInstallment, SantaClaraLookupParams } from '../types'

// Santa Clara County tax lookup URLs
export const SCC_TAX_URLS = {
  search: 'https://payments.sccgov.org/propertytax',
  parcelSearch: 'https://payments.sccgov.org/propertytax/Secured/ParcelSearch',
} as const

export interface SCCTaxLookupResult {
  success: boolean
  data?: {
    parcelNumber: string
    address: string
    taxYear: number
    annualTaxAmount: number
    installments: {
      number: 1 | 2
      amount: number
      dueDate: string
      status: 'paid' | 'unpaid' | 'delinquent'
      penaltyAmount?: number
    }[]
    assessedValue?: number
    exemptions?: number
  }
  error?: string
  rawData?: Record<string, unknown>
  screenshotPath?: string
}

/**
 * Note: This function requires Playwright which doesn't work in serverless.
 * Instead, use the standalone script: scripts/scrapers/scc-tax-lookup.ts
 *
 * This function is a placeholder that documents the expected interface.
 */
export async function lookupSCCProperty(params: SantaClaraLookupParams): Promise<SCCTaxLookupResult> {
  // In production, this would be handled by an external Playwright process
  // that POSTs results to /api/taxes/sync/callback

  return {
    success: false,
    error: 'Santa Clara County lookup requires external Playwright script. Run: npm run tax:scc'
  }
}

/**
 * Generate installment schedule for Santa Clara County
 * SCC has semi-annual payments:
 * - 1st installment due November 1, delinquent after December 10
 * - 2nd installment due February 1, delinquent after April 10
 */
export function generateSCCInstallments(taxYear: number, annualAmount: number): TaxInstallment[] {
  const halfAmount = Math.round(annualAmount / 2 * 100) / 100

  return [
    {
      installment_number: 1,
      amount: halfAmount,
      due_date: `${taxYear}-12-10`,  // Delinquent after this date
      status: 'unknown'
    },
    {
      installment_number: 2,
      amount: halfAmount,
      due_date: `${taxYear + 1}-04-10`,  // Delinquent after this date
      status: 'unknown'
    },
  ]
}

/**
 * Parse a parcel number into its components
 * Santa Clara County format: XXX-XX-XXX (e.g., 274-15-034)
 */
export function parseSCCParcelNumber(parcelNumber: string): {
  book: string
  page: string
  parcel: string
} | null {
  const match = parcelNumber.match(/^(\d{3})-(\d{2})-(\d{3})$/)
  if (!match) return null

  return {
    book: match[1],
    page: match[2],
    parcel: match[3],
  }
}
