import { describe, it, expect } from 'vitest'
import {
  parseBoACSV,
  validateBoACSV,
  getMatchableTransactions,
  generateTransactionHash,
  type ParsedTransaction,
} from '@/lib/banking/csv-parser'
import {
  VALID_BOA_CSV,
  MINIMAL_CSV,
  EMPTY_CSV,
  NO_DATA_ROWS_CSV,
  CSV_WITH_QUOTES_IN_DESCRIPTION,
  CSV_WITH_COMMAS_IN_AMOUNT,
  CSV_WITH_NOISE_TRANSACTIONS,
  CSV_WITH_ALL_CATEGORIES,
} from '../../fixtures/bank-transactions'

describe('parseBoACSV', () => {
  describe('basic parsing', () => {
    it('should parse a valid Bank of America CSV', () => {
      const result = parseBoACSV(VALID_BOA_CSV)

      expect(result.errors).toHaveLength(0)
      expect(result.transactions.length).toBeGreaterThan(0)
      expect(result.dateRangeStart).toBeInstanceOf(Date)
      expect(result.dateRangeEnd).toBeInstanceOf(Date)
    })

    it('should parse minimal CSV with just required columns', () => {
      const result = parseBoACSV(MINIMAL_CSV)

      expect(result.errors).toHaveLength(0)
      expect(result.transactions).toHaveLength(2)
    })

    it('should handle empty CSV', () => {
      const result = parseBoACSV(EMPTY_CSV)

      expect(result.errors).toContain('Empty CSV file')
      expect(result.transactions).toHaveLength(0)
    })

    it('should handle CSV with only headers', () => {
      const result = parseBoACSV(NO_DATA_ROWS_CSV)

      expect(result.transactions).toHaveLength(0)
    })
  })

  describe('date parsing', () => {
    it('should parse MM/DD/YYYY date format', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const transaction = result.transactions.find(t => t.description === 'Check 363')

      expect(transaction).toBeDefined()
      expect(transaction!.date.getMonth()).toBe(11) // December (0-indexed)
      expect(transaction!.date.getDate()).toBe(28)
      expect(transaction!.date.getFullYear()).toBe(2025)
    })

    it('should set date range from oldest to newest', () => {
      const result = parseBoACSV(VALID_BOA_CSV)

      expect(result.dateRangeStart!.getTime()).toBeLessThanOrEqual(result.dateRangeEnd!.getTime())
    })
  })

  describe('amount parsing', () => {
    it('should parse negative amounts as debits', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const checkTransaction = result.transactions.find(t => t.description === 'Check 363')

      expect(checkTransaction).toBeDefined()
      expect(checkTransaction!.amount).toBe(-450.00)
      expect(checkTransaction!.isDebit).toBe(true)
    })

    it('should parse positive amounts as credits', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const creditTransaction = result.transactions.find(t => t.description === 'Interest Earned')

      expect(creditTransaction).toBeDefined()
      expect(creditTransaction!.amount).toBe(15.43)
      expect(creditTransaction!.isDebit).toBe(false)
    })

    it('should handle amounts with commas', () => {
      const result = parseBoACSV(CSV_WITH_COMMAS_IN_AMOUNT)

      expect(result.errors).toHaveLength(0)
      const largePayment = result.transactions.find(t => t.description === 'Large Payment')
      expect(largePayment).toBeDefined()
      expect(largePayment!.amount).toBe(-25000.00)
    })
  })

  describe('check number extraction', () => {
    it('should extract check number from "Check NNN" format', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const checkTransaction = result.transactions.find(t => t.description === 'Check 363')

      expect(checkTransaction).toBeDefined()
      expect(checkTransaction!.checkNumber).toBe('363')
    })

    it('should extract check number from "Bill Pay Check NNN:" format', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const billPayCheck = result.transactions.find(t =>
        t.description?.includes('Bill Pay Check 7151')
      )

      expect(billPayCheck).toBeDefined()
      expect(billPayCheck!.checkNumber).toBe('7151')
    })

    it('should return null when no check number present', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const wireTransfer = result.transactions.find(t => t.description?.includes('WIRE TYPE'))

      expect(wireTransfer).toBeDefined()
      expect(wireTransfer!.checkNumber).toBeNull()
    })
  })

  describe('transaction categorization', () => {
    it('should categorize "Check NNN" as check', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const check = result.transactions.find(t => t.description === 'Check 500')

      expect(check).toBeDefined()
      expect(check!.category).toBe('check')
    })

    it('should categorize "Bill Pay Check NNN:" as bill_pay_check', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const billPayCheck = result.transactions.find(t =>
        t.description?.includes('Bill Pay Check 7151')
      )

      expect(billPayCheck).toBeDefined()
      expect(billPayCheck!.category).toBe('bill_pay_check')
    })

    it('should categorize "XXX Bill Payment" as bill_pay', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const billPay = result.transactions.find(t =>
        t.description?.includes('Bill Payment')
      )

      expect(billPay).toBeDefined()
      expect(billPay!.category).toBe('bill_pay')
    })

    it('should categorize utility ACH as ach_autopay', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const achAutopay = result.transactions.find(t =>
        t.description?.includes('GrMtnPower DES')
      )

      expect(achAutopay).toBeDefined()
      expect(achAutopay!.category).toBe('ach_autopay')
    })

    it('should categorize wire transfers as wire', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const wire = result.transactions.find(t => t.description?.includes('WIRE TYPE'))

      expect(wire).toBeDefined()
      expect(wire!.category).toBe('wire')
    })

    it('should categorize bank transfers as transfer', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const transfer = result.transactions.find(t =>
        t.description?.includes('Online Banking transfer')
      )

      expect(transfer).toBeDefined()
      expect(transfer!.category).toBe('transfer')
    })

    it('should categorize credit card payments as credit_card', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const creditCard = result.transactions.find(t =>
        t.description?.includes('APPLECARD')
      )

      expect(creditCard).toBeDefined()
      expect(creditCard!.category).toBe('credit_card')
    })

    it('should categorize PayPal/Venmo as noise', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)
      const noise = result.transactions.find(t =>
        t.description?.includes('PAYPAL')
      )

      expect(noise).toBeDefined()
      expect(noise!.category).toBe('noise')
    })
  })

  describe('vendor name extraction', () => {
    it('should extract vendor from "XXX Bill Payment" format', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const billPay = result.transactions.find(t =>
        t.description === 'Parker Construction Bill Payment'
      )

      expect(billPay).toBeDefined()
      expect(billPay!.extractedVendorName).toBe('Parker Construction')
    })

    it('should extract vendor from "Bill Pay Check NNN: Vendor" format', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const billPayCheck = result.transactions.find(t =>
        t.description?.includes('Bill Pay Check 7151')
      )

      expect(billPayCheck).toBeDefined()
      expect(billPayCheck!.extractedVendorName).toBe('Ocean State Elec. Sec. Syst.,I')
    })

    it('should extract vendor from ACH "XXX DES:" format', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const ach = result.transactions.find(t =>
        t.description?.includes('GrMtnPower DES')
      )

      expect(ach).toBeDefined()
      expect(ach!.extractedVendorName).toBe('GrMtnPower')
    })

    it('should extract HOA condo format', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const hoa = result.transactions.find(t =>
        t.description?.includes('Edge 11211 Condo')
      )

      expect(hoa).toBeDefined()
      expect(hoa!.extractedVendorName).toBe('Edge 11211 Condo')
    })
  })

  describe('CSV edge cases', () => {
    it('should handle quoted fields with embedded quotes', () => {
      const result = parseBoACSV(CSV_WITH_QUOTES_IN_DESCRIPTION)

      expect(result.errors).toHaveLength(0)
      expect(result.transactions).toHaveLength(2)
    })

    it('should skip Beginning balance row', () => {
      const result = parseBoACSV(VALID_BOA_CSV)
      const beginningBalance = result.transactions.find(t =>
        t.description?.toLowerCase().includes('beginning balance')
      )

      expect(beginningBalance).toBeUndefined()
    })
  })

  describe('statistics', () => {
    it('should track transaction counts by category', () => {
      const result = parseBoACSV(VALID_BOA_CSV)

      expect(result.stats.total).toBeGreaterThan(0)
      expect(result.stats.debits + result.stats.credits).toBe(result.stats.total)
    })

    it('should count checks correctly', () => {
      const result = parseBoACSV(CSV_WITH_ALL_CATEGORIES)

      // "Check 500" and "Bill Pay Check 7151" should be counted
      expect(result.stats.checks).toBe(2)
    })
  })
})

describe('validateBoACSV', () => {
  it('should validate a proper CSV', () => {
    const result = validateBoACSV(VALID_BOA_CSV)

    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should reject empty content', () => {
    const result = validateBoACSV('')

    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('should reject CSV without required columns', () => {
    const noColumns = `Name,Value
    Test,123`
    const result = validateBoACSV(noColumns)

    expect(result.valid).toBe(false)
  })
})

describe('getMatchableTransactions', () => {
  it('should filter to only debits with matchable categories', () => {
    const result = parseBoACSV(CSV_WITH_NOISE_TRANSACTIONS)
    const matchable = getMatchableTransactions(result.transactions)

    // Should include Check and Bill Payment, exclude noise (PayPal, Uber, Venmo, Interest)
    expect(matchable.length).toBeLessThan(result.transactions.length)
    expect(matchable.every(t => t.isDebit)).toBe(true)
    expect(matchable.every(t =>
      ['check', 'bill_pay', 'bill_pay_check', 'ach_autopay'].includes(t.category)
    )).toBe(true)
  })

  it('should exclude credit transactions', () => {
    const result = parseBoACSV(VALID_BOA_CSV)
    const matchable = getMatchableTransactions(result.transactions)

    const credits = matchable.filter(t => !t.isDebit)
    expect(credits).toHaveLength(0)
  })
})

describe('generateTransactionHash', () => {
  it('should generate consistent hash for same transaction', () => {
    const transaction: ParsedTransaction = {
      date: new Date('2025-12-15'),
      description: 'Check 100',
      amount: -500.00,
      checkNumber: '100',
      runningBalance: 10000,
      category: 'check',
      extractedVendorName: null,
      isDebit: true,
    }

    const hash1 = generateTransactionHash(transaction)
    const hash2 = generateTransactionHash(transaction)

    expect(hash1).toBe(hash2)
  })

  it('should generate different hashes for different transactions', () => {
    const t1: ParsedTransaction = {
      date: new Date('2025-12-15'),
      description: 'Check 100',
      amount: -500.00,
      checkNumber: '100',
      runningBalance: null,
      category: 'check',
      extractedVendorName: null,
      isDebit: true,
    }

    const t2: ParsedTransaction = {
      date: new Date('2025-12-15'),
      description: 'Check 101',
      amount: -500.00,
      checkNumber: '101',
      runningBalance: null,
      category: 'check',
      extractedVendorName: null,
      isDebit: true,
    }

    expect(generateTransactionHash(t1)).not.toBe(generateTransactionHash(t2))
  })

  it('should return 8-character hex string', () => {
    const transaction: ParsedTransaction = {
      date: new Date('2025-12-15'),
      description: 'Test',
      amount: -100,
      checkNumber: null,
      runningBalance: null,
      category: 'other',
      extractedVendorName: null,
      isDebit: true,
    }

    const hash = generateTransactionHash(transaction)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })
})
