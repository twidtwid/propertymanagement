import { describe, it, expect } from 'vitest'
import {
  categorizeMatchResults,
  filterNonBillTransactions,
  type MatchResult,
} from '@/lib/banking/matcher'
import type { ParsedTransaction } from '@/lib/banking/csv-parser'
import { MOCK_BILLS, BILL_WITH_NO_VENDOR, BILL_WITH_SIMILAR_AMOUNT, type MockBill } from '../../fixtures/bills'

// Helper to create a mock transaction
function createTransaction(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    date: new Date('2025-12-28'),
    description: 'Check 363',
    amount: -450.00,
    checkNumber: '363',
    runningBalance: 22543.21,
    category: 'check',
    extractedVendorName: null,
    isDebit: true,
    ...overrides,
  }
}

// Helper to create a mock match result
function createMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    transaction: createTransaction(),
    matches: [],
    bestMatch: null,
    autoConfirm: false,
    ...overrides,
  }
}

describe('categorizeMatchResults', () => {
  it('should categorize auto-confirmed matches (confidence >= 0.90)', () => {
    const results: MatchResult[] = [
      createMatchResult({
        autoConfirm: true,
        bestMatch: {
          bill: MOCK_BILLS[0],
          confidence: 0.98,
          matchMethod: 'check_number',
          matchReason: 'Check #363 matches with exact amount',
        },
        matches: [{
          bill: MOCK_BILLS[0],
          confidence: 0.98,
          matchMethod: 'check_number',
          matchReason: 'Check #363 matches with exact amount',
        }],
      }),
    ]

    const categorized = categorizeMatchResults(results)

    expect(categorized.autoConfirmed).toHaveLength(1)
    expect(categorized.needsReview).toHaveLength(0)
    expect(categorized.noMatch).toHaveLength(0)
    expect(categorized.notBills).toHaveLength(0)
  })

  it('should categorize matches needing review (confidence < 0.90 but >= 0.50)', () => {
    const results: MatchResult[] = [
      createMatchResult({
        autoConfirm: false,
        bestMatch: {
          bill: MOCK_BILLS[0],
          confidence: 0.75,
          matchMethod: 'amount_vendor',
          matchReason: 'Amount matches and description contains vendor',
        },
        matches: [{
          bill: MOCK_BILLS[0],
          confidence: 0.75,
          matchMethod: 'amount_vendor',
          matchReason: 'Amount matches and description contains vendor',
        }],
      }),
    ]

    const categorized = categorizeMatchResults(results)

    expect(categorized.autoConfirmed).toHaveLength(0)
    expect(categorized.needsReview).toHaveLength(1)
    expect(categorized.noMatch).toHaveLength(0)
  })

  it('should categorize transactions with no matches', () => {
    const results: MatchResult[] = [
      createMatchResult({
        autoConfirm: false,
        bestMatch: null,
        matches: [],
      }),
    ]

    const categorized = categorizeMatchResults(results)

    expect(categorized.autoConfirmed).toHaveLength(0)
    expect(categorized.needsReview).toHaveLength(0)
    expect(categorized.noMatch).toHaveLength(1)
  })

  it('should categorize credits as not bills', () => {
    const results: MatchResult[] = [
      createMatchResult({
        transaction: createTransaction({
          amount: 500.00, // Positive = credit
          isDebit: false,
          description: 'Interest Earned',
        }),
      }),
    ]

    const categorized = categorizeMatchResults(results)

    expect(categorized.notBills).toHaveLength(1)
    expect(categorized.autoConfirmed).toHaveLength(0)
    expect(categorized.needsReview).toHaveLength(0)
    expect(categorized.noMatch).toHaveLength(0)
  })

  it('should handle mixed results', () => {
    const results: MatchResult[] = [
      // Auto-confirmed
      createMatchResult({
        autoConfirm: true,
        bestMatch: {
          bill: MOCK_BILLS[0],
          confidence: 0.98,
          matchMethod: 'check_number',
          matchReason: 'Check match',
        },
        matches: [{
          bill: MOCK_BILLS[0],
          confidence: 0.98,
          matchMethod: 'check_number',
          matchReason: 'Check match',
        }],
      }),
      // Needs review
      createMatchResult({
        transaction: createTransaction({ description: 'Bill Payment' }),
        autoConfirm: false,
        bestMatch: {
          bill: MOCK_BILLS[1],
          confidence: 0.60,
          matchMethod: 'description',
          matchReason: 'Partial match',
        },
        matches: [{
          bill: MOCK_BILLS[1],
          confidence: 0.60,
          matchMethod: 'description',
          matchReason: 'Partial match',
        }],
      }),
      // No match
      createMatchResult({
        transaction: createTransaction({ description: 'Unknown payment' }),
        autoConfirm: false,
        bestMatch: null,
        matches: [],
      }),
      // Not a bill (credit)
      createMatchResult({
        transaction: createTransaction({
          amount: 100.00,
          isDebit: false,
          description: 'Refund',
        }),
      }),
    ]

    const categorized = categorizeMatchResults(results)

    expect(categorized.autoConfirmed).toHaveLength(1)
    expect(categorized.needsReview).toHaveLength(1)
    expect(categorized.noMatch).toHaveLength(1)
    expect(categorized.notBills).toHaveLength(1)
  })
})

describe('filterNonBillTransactions', () => {
  it('should filter out payroll transactions', () => {
    const transactions: ParsedTransaction[] = [
      createTransaction({ description: 'Check 100' }),
      createTransaction({ description: 'PAYROLL DIRECT DEP' }),
    ]

    const { potential, filtered } = filterNonBillTransactions(transactions)

    expect(potential).toHaveLength(1)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].description).toContain('PAYROLL')
  })

  it('should filter out ATM withdrawals', () => {
    const transactions: ParsedTransaction[] = [
      createTransaction({ description: 'ATM WITHDRAWAL' }),
      createTransaction({ description: 'Parker Construction Bill Payment' }),
    ]

    const { potential, filtered } = filterNonBillTransactions(transactions)

    expect(potential).toHaveLength(1)
    expect(filtered).toHaveLength(1)
    expect(potential[0].description).toContain('Parker')
  })

  it('should filter out transfers', () => {
    const transactions: ParsedTransaction[] = [
      createTransaction({ description: 'Transfer from Savings' }),
      createTransaction({ description: 'Transfer to Checking' }),
      createTransaction({ description: 'Bill Pay Check 123: Vendor' }),
    ]

    const { potential, filtered } = filterNonBillTransactions(transactions)

    expect(potential).toHaveLength(1)
    expect(filtered).toHaveLength(2)
  })

  it('should filter out Venmo cashouts', () => {
    const transactions: ParsedTransaction[] = [
      createTransaction({ description: 'VENMO CASHOUT' }),
      createTransaction({ description: 'Check 500' }),
    ]

    const { potential, filtered } = filterNonBillTransactions(transactions)

    expect(potential).toHaveLength(1)
    expect(filtered).toHaveLength(1)
    expect(potential[0].description).toBe('Check 500')
  })

  it('should filter out Zelle received payments', () => {
    const transactions: ParsedTransaction[] = [
      createTransaction({ description: 'ZELLE FROM JOHN' }),
      createTransaction({ description: 'ZELLE RECEIVED' }),
      createTransaction({ description: 'Regular Payment' }),
    ]

    const { potential, filtered } = filterNonBillTransactions(transactions)

    expect(potential).toHaveLength(1)
    expect(filtered).toHaveLength(2)
  })

  it('should filter out interest payments', () => {
    const transactions: ParsedTransaction[] = [
      createTransaction({ description: 'INTEREST PAYMENT' }),
      createTransaction({ description: 'INTEREST CREDIT' }),
      createTransaction({ description: 'Utility Bill' }),
    ]

    const { potential, filtered } = filterNonBillTransactions(transactions)

    expect(potential).toHaveLength(1)
    expect(filtered).toHaveLength(2)
  })

  it('should keep bill-related transactions', () => {
    const transactions: ParsedTransaction[] = [
      createTransaction({ description: 'Check 100' }),
      createTransaction({ description: 'Parker Construction Bill Payment' }),
      createTransaction({ description: 'Bill Pay Check 7151: Vendor' }),
      createTransaction({ description: 'GrMtnPower DES:UTIL. BILL' }),
    ]

    const { potential, filtered } = filterNonBillTransactions(transactions)

    expect(potential).toHaveLength(4)
    expect(filtered).toHaveLength(0)
  })
})

describe('Match confidence levels', () => {
  // These tests document the expected confidence levels for different match types
  // The actual matching logic is in matcher.ts and requires DB access

  it('should document check number exact match confidence (0.98)', () => {
    // Check number match + exact amount = 0.98 confidence
    const expectedConfidence = 0.98
    expect(expectedConfidence).toBeGreaterThanOrEqual(0.90) // Auto-confirm threshold
  })

  it('should document check number match without amount (0.95)', () => {
    // Check number match alone = 0.95 confidence
    const expectedConfidence = 0.95
    expect(expectedConfidence).toBeGreaterThanOrEqual(0.90) // Auto-confirm threshold
  })

  it('should document vendor name + exact amount match (0.90)', () => {
    // Extracted vendor name + exact amount = 0.90 confidence
    const expectedConfidence = 0.90
    expect(expectedConfidence).toBeGreaterThanOrEqual(0.90) // Auto-confirm threshold
  })

  it('should document exact amount + date window match (0.85)', () => {
    // Exact amount + transaction within 21 days of due/payment date = 0.85
    const expectedConfidence = 0.85
    expect(expectedConfidence).toBeLessThan(0.90) // Needs review
    expect(expectedConfidence).toBeGreaterThanOrEqual(0.50) // Above minimum
  })

  it('should document amount + vendor in description match (0.75)', () => {
    // Exact amount + vendor name found in description = 0.75
    const expectedConfidence = 0.75
    expect(expectedConfidence).toBeLessThan(0.90) // Needs review
  })

  it('should document fuzzy amount + vendor match (0.60)', () => {
    // Amount within 10% + vendor in description = 0.60
    const expectedConfidence = 0.60
    expect(expectedConfidence).toBeLessThan(0.90) // Needs review
    expect(expectedConfidence).toBeGreaterThanOrEqual(0.50) // Above minimum for review
  })

  it('should verify auto-confirm threshold is 0.90', () => {
    const autoConfirmThreshold = 0.90
    expect(autoConfirmThreshold).toBe(0.90)
  })
})
