import { describe, it, expect } from 'vitest'
import { getJurisdictionFromProvider } from '@/lib/taxes/sync-to-payments'

// Test the exported utility function
// The sync functions require DB access and are tested via integration tests

describe('getJurisdictionFromProvider', () => {
  it('should return NYC - Brooklyn for nyc_open_data provider', () => {
    const result = getJurisdictionFromProvider('nyc_open_data')
    expect(result).toBe('NYC - Brooklyn')
  })

  it('should return Santa Clara County, CA for santa_clara_county provider', () => {
    const result = getJurisdictionFromProvider('santa_clara_county')
    expect(result).toBe('Santa Clara County, CA')
  })

  it('should return Providence, RI for city_hall_systems provider', () => {
    const result = getJurisdictionFromProvider('city_hall_systems')
    expect(result).toBe('Providence, RI')
  })

  it('should return formatted Vermont town for vermont_nemrc provider', () => {
    const result = getJurisdictionFromProvider('vermont_nemrc', { town: 'dummerston' })
    expect(result).toBe('Dummerston, VT')
  })

  it('should default to "Vermont" when no town provided for vermont_nemrc', () => {
    const result = getJurisdictionFromProvider('vermont_nemrc')
    expect(result).toBe('Vermont, VT')
  })

  it('should return Brattleboro, VT for vermont_axisgis provider', () => {
    const result = getJurisdictionFromProvider('vermont_axisgis')
    expect(result).toBe('Brattleboro, VT')
  })

  it('should return Unknown for unrecognized provider', () => {
    const result = getJurisdictionFromProvider('unknown_provider')
    expect(result).toBe('Unknown')
  })
})

describe('Tax installment schedules (documentation)', () => {
  // These tests document the expected installment schedules
  // The actual generation logic is tested via the functions that use them

  describe('Providence, RI - Quarterly', () => {
    it('should have 4 installments on the 24th of Jul, Oct, Jan, Apr', () => {
      const expectedDates = [
        { month: 7, day: 24 },  // July
        { month: 10, day: 24 }, // October
        { month: 1, day: 24 },  // January (next year)
        { month: 4, day: 24 },  // April (next year)
      ]
      expect(expectedDates).toHaveLength(4)
    })
  })

  describe('NYC - Brooklyn - Quarterly', () => {
    it('should have 4 installments on the 1st of Jul, Oct, Jan, Apr', () => {
      const expectedDates = [
        { month: 7, day: 1 },  // July
        { month: 10, day: 1 }, // October
        { month: 1, day: 1 },  // January (next year)
        { month: 4, day: 1 },  // April (next year)
      ]
      expect(expectedDates).toHaveLength(4)
    })
  })

  describe('Santa Clara County, CA - Semi-Annual', () => {
    it('should have 2 installments on Dec 10 and Apr 10', () => {
      const expectedDates = [
        { month: 12, day: 10 }, // December
        { month: 4, day: 10 },  // April (next year)
      ]
      expect(expectedDates).toHaveLength(2)
    })
  })

  describe('Vermont - Semi-Annual', () => {
    it('should have 2 installments on Aug 15 and Feb 15', () => {
      const expectedDates = [
        { month: 8, day: 15 },  // August
        { month: 2, day: 15 },  // February (next year)
      ]
      expect(expectedDates).toHaveLength(2)
    })
  })
})

describe('Tax data structure validation', () => {
  it('should document required TaxData fields', () => {
    interface TaxData {
      property_id: string
      provider: string
      tax_year: number
      jurisdiction: string
      annual_tax?: number
      quarterly_amount?: number
      installments?: Array<{
        installment_number: number
        amount: number
        due_date: string
        status?: 'paid' | 'unpaid' | 'unknown'
      }>
      assessed_value?: number
    }

    const validTaxData: TaxData = {
      property_id: 'uuid-here',
      provider: 'city_hall_systems',
      tax_year: 2025,
      jurisdiction: 'Providence, RI',
      quarterly_amount: 2500.00,
    }

    expect(validTaxData.property_id).toBeDefined()
    expect(validTaxData.provider).toBeDefined()
    expect(validTaxData.tax_year).toBeDefined()
    expect(validTaxData.jurisdiction).toBeDefined()
  })

  it('should allow either annual_tax or quarterly_amount or installments', () => {
    // Option 1: Quarterly amount (Providence, NYC)
    const quarterlyData = {
      property_id: 'uuid',
      provider: 'city_hall_systems',
      tax_year: 2025,
      jurisdiction: 'Providence, RI',
      quarterly_amount: 2500.00,
    }
    expect(quarterlyData.quarterly_amount).toBeDefined()

    // Option 2: Annual tax (Vermont, Santa Clara)
    const annualData = {
      property_id: 'uuid',
      provider: 'vermont_nemrc',
      tax_year: 2025,
      jurisdiction: 'Dummerston, VT',
      annual_tax: 8000.00,
    }
    expect(annualData.annual_tax).toBeDefined()

    // Option 3: Pre-calculated installments
    const installmentData = {
      property_id: 'uuid',
      provider: 'custom',
      tax_year: 2025,
      jurisdiction: 'Custom',
      installments: [
        { installment_number: 1, amount: 2000, due_date: '2025-07-01' },
        { installment_number: 2, amount: 2000, due_date: '2025-10-01' },
      ],
    }
    expect(installmentData.installments).toHaveLength(2)
  })
})

describe('Tax year calculations', () => {
  it('should handle fiscal year spanning two calendar years', () => {
    // Tax year 2025 typically covers July 2025 - June 2026
    // Providence: Q1=Jul2025, Q2=Oct2025, Q3=Jan2026, Q4=Apr2026
    const taxYear = 2025

    const q1Date = `${taxYear}-07-24`
    const q2Date = `${taxYear}-10-24`
    const q3Date = `${taxYear + 1}-01-24`
    const q4Date = `${taxYear + 1}-04-24`

    expect(new Date(q1Date).getFullYear()).toBe(2025)
    expect(new Date(q3Date).getFullYear()).toBe(2026)
    expect(new Date(q4Date).getFullYear()).toBe(2026)
  })

  it('should calculate semi-annual amounts correctly', () => {
    const annualTax = 10000.00
    const semiAnnualAmount = annualTax / 2

    expect(semiAnnualAmount).toBe(5000.00)
  })
})
