// Transaction Matcher
// Matches bank transactions to pending bills

import { query } from "../db"
import type { ParsedTransaction } from "./csv-parser"
import type { Bill, Vendor } from "@/types/database"

export interface MatchCandidate {
  bill: BillWithDetails
  confidence: number  // 0.00 to 1.00
  matchMethod: 'check_number' | 'amount_date' | 'amount_vendor' | 'description'
  matchReason: string
}

export interface MatchResult {
  transaction: ParsedTransaction
  matches: MatchCandidate[]
  bestMatch: MatchCandidate | null
  autoConfirm: boolean  // True if confidence >= 0.90
}

interface BillWithDetails extends Bill {
  vendor_name?: string
  vendor_company?: string
  property_name?: string
}

// Get pending/sent bills for matching
async function getPendingBills(): Promise<BillWithDetails[]> {
  return query<BillWithDetails>(`
    SELECT
      b.*,
      v.name as vendor_name,
      v.company as vendor_company,
      p.name as property_name
    FROM bills b
    LEFT JOIN vendors v ON b.vendor_id = v.id
    LEFT JOIN properties p ON b.property_id = p.id
    WHERE b.status IN ('pending', 'sent')
    ORDER BY b.due_date
  `)
}

// Get vendors for description matching
async function getVendors(): Promise<Vendor[]> {
  return query<Vendor>('SELECT * FROM vendors WHERE is_active = TRUE')
}

// Match a single transaction to bills
async function matchTransaction(
  transaction: ParsedTransaction,
  pendingBills: BillWithDetails[],
  vendors: Vendor[]
): Promise<MatchResult> {
  const result: MatchResult = {
    transaction,
    matches: [],
    bestMatch: null,
    autoConfirm: false
  }

  // Only match debits (negative amounts = money going out)
  if (transaction.amount >= 0) {
    return result
  }

  const transactionAmount = Math.abs(transaction.amount)
  const transactionDate = transaction.date

  for (const bill of pendingBills) {
    // Priority 1: Check number match (confidence: 0.95)
    if (transaction.checkNumber && bill.payment_reference) {
      if (transaction.checkNumber === bill.payment_reference) {
        result.matches.push({
          bill,
          confidence: 0.95,
          matchMethod: 'check_number',
          matchReason: `Check number ${transaction.checkNumber} matches payment reference`
        })
        continue
      }
    }

    // Check if amounts match (within $0.01)
    const amountMatches = Math.abs(bill.amount - transactionAmount) < 0.01

    // Check if date is within range (transaction within 21 days after payment date or due date)
    const billDate = bill.payment_date ? new Date(bill.payment_date) : new Date(bill.due_date)
    const daysDiff = Math.floor((transactionDate.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24))
    const dateWithinRange = daysDiff >= -7 && daysDiff <= 21

    // Priority 2: Exact amount + date window (confidence: 0.85)
    if (amountMatches && dateWithinRange) {
      result.matches.push({
        bill,
        confidence: 0.85,
        matchMethod: 'amount_date',
        matchReason: `Amount $${transactionAmount.toFixed(2)} matches, date within range`
      })
      continue
    }

    // Priority 3: Amount + vendor name in description (confidence: 0.75)
    if (amountMatches && bill.vendor_name) {
      const descLower = transaction.description.toLowerCase()
      const vendorName = bill.vendor_name.toLowerCase()
      const vendorCompany = bill.vendor_company?.toLowerCase() || ''

      if (descLower.includes(vendorName) || (vendorCompany && descLower.includes(vendorCompany))) {
        result.matches.push({
          bill,
          confidence: 0.75,
          matchMethod: 'amount_vendor',
          matchReason: `Amount matches and description contains vendor name`
        })
        continue
      }
    }

    // Priority 4: Amount within 10% + vendor match (confidence: 0.60)
    const amountWithinTolerance = Math.abs(bill.amount - transactionAmount) / bill.amount <= 0.10
    if (amountWithinTolerance && bill.vendor_name) {
      const descLower = transaction.description.toLowerCase()
      const vendorName = bill.vendor_name.toLowerCase()
      const vendorCompany = bill.vendor_company?.toLowerCase() || ''

      if (descLower.includes(vendorName) || (vendorCompany && descLower.includes(vendorCompany))) {
        result.matches.push({
          bill,
          confidence: 0.60,
          matchMethod: 'description',
          matchReason: `Amount within 10% and vendor name found in description`
        })
        continue
      }
    }
  }

  // Sort matches by confidence (highest first)
  result.matches.sort((a, b) => b.confidence - a.confidence)

  // Set best match if we have any
  if (result.matches.length > 0) {
    result.bestMatch = result.matches[0]
    result.autoConfirm = result.bestMatch.confidence >= 0.90
  }

  return result
}

// Match all transactions to bills
export async function matchTransactionsToBills(
  transactions: ParsedTransaction[]
): Promise<MatchResult[]> {
  const pendingBills = await getPendingBills()
  const vendors = await getVendors()
  const results: MatchResult[] = []

  for (const transaction of transactions) {
    const result = await matchTransaction(transaction, pendingBills, vendors)
    results.push(result)
  }

  return results
}

// Categorize match results for UI display
export function categorizeMatchResults(results: MatchResult[]): {
  autoConfirmed: MatchResult[]
  needsReview: MatchResult[]
  noMatch: MatchResult[]
  notBills: MatchResult[]
} {
  const autoConfirmed: MatchResult[] = []
  const needsReview: MatchResult[] = []
  const noMatch: MatchResult[] = []
  const notBills: MatchResult[] = []

  for (const result of results) {
    // Credits (positive amounts) are not bills
    if (result.transaction.amount >= 0) {
      notBills.push(result)
      continue
    }

    if (result.autoConfirm && result.bestMatch) {
      autoConfirmed.push(result)
    } else if (result.bestMatch && result.bestMatch.confidence >= 0.50) {
      needsReview.push(result)
    } else if (result.matches.length > 0) {
      needsReview.push(result)
    } else {
      noMatch.push(result)
    }
  }

  return { autoConfirmed, needsReview, noMatch, notBills }
}

// Filter out common non-bill transactions
export function filterNonBillTransactions(transactions: ParsedTransaction[]): {
  potential: ParsedTransaction[]
  filtered: ParsedTransaction[]
} {
  const nonBillPatterns = [
    /\bpayroll\b/i,
    /\bdirect\s*dep/i,
    /\batm\b/i,
    /\bwithdrawal\b/i,
    /\btransfer\s*(from|to)\b/i,
    /\bvenmo\s*cashout\b/i,
    /\bzelle\s*(from|received)\b/i,
    /\binterest\s*payment\b/i,
    /\binterest\s*credit\b/i,
    /\bdividend\b/i,
  ]

  const potential: ParsedTransaction[] = []
  const filtered: ParsedTransaction[] = []

  for (const txn of transactions) {
    const isNonBill = nonBillPatterns.some(pattern => pattern.test(txn.description))
    if (isNonBill) {
      filtered.push(txn)
    } else {
      potential.push(txn)
    }
  }

  return { potential, filtered }
}
