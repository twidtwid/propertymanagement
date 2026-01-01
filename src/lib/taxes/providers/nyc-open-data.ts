/**
 * NYC Property Tax Lookup via Open Data API
 *
 * Data source: NYC Department of Finance Property Valuation and Assessment Data
 * API: https://data.cityofnewyork.us/resource/8y4t-faws.json
 *
 * This provides assessed values and tax class info, not actual bills.
 * Use boro + block + lot to look up properties.
 */

import type { TaxLookupResult, TaxInstallment, NYCLookupParams } from '../types'

const NYC_API_URL = 'https://data.cityofnewyork.us/resource/8y4t-faws.json'

// NYC borough codes
export const NYC_BOROUGHS = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
} as const

interface NYCApiResponse {
  parid: string
  boro: string
  block: string
  lot: string
  year: string
  owner: string
  street_name: string
  housenum_lo: string
  housenum_hi?: string
  zip_code?: string
  bldg_class: string
  // Current year values
  curmkttot: string      // Current market value total
  curmktland: string     // Current market value land
  curacttot: string      // Current actual value total
  curtxbtot: string      // Current taxable value total
  curtaxclass: string    // Current tax class
  // Final values (after appeals)
  finmkttot?: string
  finacttot?: string
  fintxbtot?: string
  fintaxclass?: string
  // Tentative values
  tenmkttot?: string
  tenacttot?: string
  tentxbtot?: string
  // Additional fields
  units?: string
  gross_sqft?: string
  land_area?: string
  yrbuilt?: string
  condo_number?: string
}

export interface NYCTaxLookupResult {
  success: boolean
  data?: {
    parcelId: string
    owner: string
    address: string
    borough: string
    block: string
    lot: string
    year: number
    buildingClass: string
    taxClass: string
    marketValue: number
    assessedValue: number
    taxableValue: number
    units?: number
    grossSqft?: number
    yearBuilt?: number
    condoNumber?: string
  }
  error?: string
  rawData?: NYCApiResponse
}

/**
 * Look up NYC property tax data using Borough-Block-Lot (BBL)
 */
export async function lookupNYCProperty(params: NYCLookupParams): Promise<NYCTaxLookupResult> {
  const { borough, block, lot } = params

  // Validate inputs
  if (!borough || !block || !lot) {
    return { success: false, error: 'Missing required parameters: borough, block, lot' }
  }

  try {
    // Build API URL with query parameters
    const url = new URL(NYC_API_URL)
    url.searchParams.set('boro', borough)
    url.searchParams.set('block', block.replace(/^0+/, '')) // Remove leading zeros
    url.searchParams.set('lot', lot.replace(/^0+/, ''))     // Remove leading zeros

    console.log(`[NYC Tax] Fetching: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `API error: ${response.status} ${response.statusText}`
      }
    }

    const data: NYCApiResponse[] = await response.json()

    if (!data || data.length === 0) {
      return {
        success: false,
        error: `No property found for BBL: ${borough}-${block}-${lot}`
      }
    }

    // Take the most recent record
    const record = data[0]

    // Build address string
    const address = [
      record.housenum_lo,
      record.housenum_hi && record.housenum_hi !== record.housenum_lo
        ? `-${record.housenum_hi}`
        : '',
      record.street_name,
    ].filter(Boolean).join(' ')

    return {
      success: true,
      data: {
        parcelId: record.parid,
        owner: record.owner,
        address,
        borough: NYC_BOROUGHS[borough as keyof typeof NYC_BOROUGHS] || borough,
        block: record.block,
        lot: record.lot,
        year: parseInt(record.year, 10),
        buildingClass: record.bldg_class,
        taxClass: record.curtaxclass || record.fintaxclass || '',
        marketValue: parseFloat(record.curmkttot || record.finmkttot || '0'),
        assessedValue: parseFloat(record.curacttot || record.finacttot || '0'),
        taxableValue: parseFloat(record.curtxbtot || record.fintxbtot || '0'),
        units: record.units ? parseInt(record.units, 10) : undefined,
        grossSqft: record.gross_sqft ? parseInt(record.gross_sqft, 10) : undefined,
        yearBuilt: record.yrbuilt ? parseInt(record.yrbuilt, 10) : undefined,
        condoNumber: record.condo_number || undefined,
      },
      rawData: record,
    }
  } catch (error) {
    console.error('[NYC Tax] Lookup failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Calculate estimated quarterly tax bill from assessed value
 * NYC tax rates vary by tax class - these are approximate
 */
export function estimateNYCTaxBill(assessedValue: number, taxClass: string): {
  annualTax: number
  quarterlyTax: number
  taxRate: number
} {
  // Approximate NYC tax rates by class (2024 rates)
  // Class 1: 1-3 family homes - ~20.3%
  // Class 2: Apartments, co-ops, condos - ~12.5%
  // Class 3: Utility property - ~12.8%
  // Class 4: Commercial - ~10.7%
  const taxRates: Record<string, number> = {
    '1': 0.20309,
    '2': 0.12502,
    '2A': 0.12502,
    '2B': 0.12502,
    '2C': 0.12502,
    '3': 0.12826,
    '4': 0.10694,
  }

  const rate = taxRates[taxClass] || taxRates['2'] // Default to Class 2
  const annualTax = assessedValue * rate
  const quarterlyTax = annualTax / 4

  return {
    annualTax: Math.round(annualTax * 100) / 100,
    quarterlyTax: Math.round(quarterlyTax * 100) / 100,
    taxRate: rate,
  }
}

/**
 * Generate installment schedule for NYC property taxes
 * NYC has quarterly payments due Jul 1, Oct 1, Jan 1, Apr 1
 */
export function generateNYCInstallments(year: number, quarterlyAmount: number): TaxInstallment[] {
  return [
    { installment_number: 1, amount: quarterlyAmount, due_date: `${year}-07-01`, status: 'unknown' },
    { installment_number: 2, amount: quarterlyAmount, due_date: `${year}-10-01`, status: 'unknown' },
    { installment_number: 3, amount: quarterlyAmount, due_date: `${year + 1}-01-01`, status: 'unknown' },
    { installment_number: 4, amount: quarterlyAmount, due_date: `${year + 1}-04-01`, status: 'unknown' },
  ]
}
