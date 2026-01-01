/**
 * Sync Tax Lookup Results to Property Taxes Table
 *
 * This module takes tax data from lookups and creates/updates entries
 * in the property_taxes table so they appear on the calendar and payments page.
 */

import { query, queryOne } from '../db'

interface TaxInstallment {
  installment_number: number
  amount: number
  due_date: string
  status?: 'paid' | 'unpaid' | 'unknown'
}

interface TaxData {
  property_id: string
  provider: string
  tax_year: number
  jurisdiction: string
  annual_tax?: number
  quarterly_amount?: number
  installments?: TaxInstallment[]
  assessed_value?: number
}

/**
 * Sync tax data to the property_taxes table
 * Creates or updates installment records for the calendar/payments view
 */
export async function syncTaxToPayments(data: TaxData): Promise<{
  success: boolean
  created: number
  updated: number
  error?: string
}> {
  try {
    let created = 0
    let updated = 0

    // Determine installments
    let installments: TaxInstallment[] = data.installments || []

    // If no installments provided, generate from annual or quarterly amounts
    if (installments.length === 0) {
      if (data.quarterly_amount) {
        // Quarterly payments (Providence, NYC)
        installments = generateQuarterlyInstallments(data.tax_year, data.quarterly_amount, data.jurisdiction)
      } else if (data.annual_tax) {
        // Semi-annual payments (Vermont, Santa Clara)
        installments = generateSemiAnnualInstallments(data.tax_year, data.annual_tax, data.jurisdiction)
      }
    }

    // Upsert each installment
    for (const inst of installments) {
      const existing = await queryOne<{ id: string; status: string }>(`
        SELECT id, status FROM property_taxes
        WHERE property_id = $1 AND tax_year = $2 AND jurisdiction = $3 AND installment = $4
      `, [data.property_id, data.tax_year, data.jurisdiction, inst.installment_number])

      if (existing) {
        // Only update if not already paid
        if (existing.status !== 'confirmed' && existing.status !== 'paid') {
          await query(`
            UPDATE property_taxes
            SET amount = $1, due_date = $2, updated_at = NOW()
            WHERE id = $3
          `, [inst.amount, inst.due_date, existing.id])
          updated++
        }
      } else {
        // Create new record
        await query(`
          INSERT INTO property_taxes (
            property_id, tax_year, jurisdiction, installment,
            amount, due_date, status, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        `, [
          data.property_id,
          data.tax_year,
          data.jurisdiction,
          inst.installment_number,
          inst.amount,
          inst.due_date,
          `Auto-synced from ${data.provider}`
        ])
        created++
      }
    }

    return { success: true, created, updated }
  } catch (error) {
    return {
      success: false,
      created: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate quarterly installments based on jurisdiction patterns
 */
function generateQuarterlyInstallments(
  taxYear: number,
  quarterlyAmount: number,
  jurisdiction: string
): TaxInstallment[] {
  // Providence RI: Jul 24, Oct 24, Jan 24, Apr 24
  if (jurisdiction.toLowerCase().includes('providence')) {
    return [
      { installment_number: 1, amount: quarterlyAmount, due_date: `${taxYear}-07-24` },
      { installment_number: 2, amount: quarterlyAmount, due_date: `${taxYear}-10-24` },
      { installment_number: 3, amount: quarterlyAmount, due_date: `${taxYear + 1}-01-24` },
      { installment_number: 4, amount: quarterlyAmount, due_date: `${taxYear + 1}-04-24` },
    ]
  }

  // NYC: Jul 1, Oct 1, Jan 1, Apr 1
  if (jurisdiction.toLowerCase().includes('nyc') || jurisdiction.toLowerCase().includes('brooklyn')) {
    return [
      { installment_number: 1, amount: quarterlyAmount, due_date: `${taxYear}-07-01` },
      { installment_number: 2, amount: quarterlyAmount, due_date: `${taxYear}-10-01` },
      { installment_number: 3, amount: quarterlyAmount, due_date: `${taxYear + 1}-01-01` },
      { installment_number: 4, amount: quarterlyAmount, due_date: `${taxYear + 1}-04-01` },
    ]
  }

  // Default quarterly: first of quarter months
  return [
    { installment_number: 1, amount: quarterlyAmount, due_date: `${taxYear}-07-01` },
    { installment_number: 2, amount: quarterlyAmount, due_date: `${taxYear}-10-01` },
    { installment_number: 3, amount: quarterlyAmount, due_date: `${taxYear + 1}-01-01` },
    { installment_number: 4, amount: quarterlyAmount, due_date: `${taxYear + 1}-04-01` },
  ]
}

/**
 * Generate semi-annual installments based on jurisdiction patterns
 */
function generateSemiAnnualInstallments(
  taxYear: number,
  annualTax: number,
  jurisdiction: string
): TaxInstallment[] {
  const semiAnnualAmount = annualTax / 2

  // Santa Clara County: Dec 10, Apr 10
  if (jurisdiction.toLowerCase().includes('santa clara')) {
    return [
      { installment_number: 1, amount: semiAnnualAmount, due_date: `${taxYear}-12-10` },
      { installment_number: 2, amount: semiAnnualAmount, due_date: `${taxYear + 1}-04-10` },
    ]
  }

  // Vermont: Aug 15, Feb 15
  if (jurisdiction.toLowerCase().includes('vt') || jurisdiction.toLowerCase().includes('vermont')) {
    return [
      { installment_number: 1, amount: semiAnnualAmount, due_date: `${taxYear}-08-15` },
      { installment_number: 2, amount: semiAnnualAmount, due_date: `${taxYear + 1}-02-15` },
    ]
  }

  // Default semi-annual
  return [
    { installment_number: 1, amount: semiAnnualAmount, due_date: `${taxYear}-12-01` },
    { installment_number: 2, amount: semiAnnualAmount, due_date: `${taxYear + 1}-06-01` },
  ]
}

/**
 * Get jurisdiction string from provider
 */
export function getJurisdictionFromProvider(provider: string, lookupParams?: Record<string, string>): string {
  switch (provider) {
    case 'nyc_open_data':
      return 'NYC - Brooklyn'
    case 'santa_clara_county':
      return 'Santa Clara County, CA'
    case 'city_hall_systems':
      return 'Providence, RI'
    case 'vermont_nemrc':
      const town = lookupParams?.town || 'Vermont'
      return `${town.charAt(0).toUpperCase() + town.slice(1)}, VT`
    case 'vermont_axisgis':
      return 'Brattleboro, VT'
    default:
      return 'Unknown'
  }
}
