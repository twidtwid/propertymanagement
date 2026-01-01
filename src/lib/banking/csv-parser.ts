// Bank of America CSV Parser
// Parses CSV transaction files downloaded from Bank of America
//
// BoA CSV format:
// Lines 1-5: Summary header (Beginning balance, Total credits, Total debits, Ending balance)
// Line 6: Empty
// Line 7: Column headers "Date,Description,Amount,Running Bal."
// Line 8+: Transactions

export type TransactionCategory =
  | 'check'           // "Check 363"
  | 'bill_pay'        // "Parker Construction Bill Payment"
  | 'bill_pay_check'  // "Bill Pay Check 7151: Vendor"
  | 'ach_autopay'     // "GrMtnPower DES:", "PPL Rhode Island DES:UTIL. BILL"
  | 'wire'            // "WIRE TYPE:"
  | 'transfer'        // "Online Banking transfer", "TRANSFER"
  | 'credit_card'     // "APPLECARD", "AMERICAN EXPRESS"
  | 'noise'           // "PAYPAL", "UBER", "VENMO", "Interest"
  | 'other'

export interface ParsedTransaction {
  date: Date
  description: string
  amount: number  // Negative = debit (payment out), Positive = credit
  checkNumber: string | null
  runningBalance: number | null
  // Enhanced metadata for matching
  category: TransactionCategory
  extractedVendorName: string | null
  isDebit: boolean
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  dateRangeStart: Date | null
  dateRangeEnd: Date | null
  accountType: string | null
  errors: string[]
  // Enhanced stats
  stats: {
    total: number
    debits: number
    credits: number
    checks: number
    billPay: number
    achAutopay: number
    wires: number
    transfers: number
    creditCards: number
    noise: number
    other: number
  }
}

// Bank of America CSV format (as of 2025):
// Header rows (variable), then:
// Date,Description,Amount,Running Bal.
// 12/28/2025,"Check 1234",-450.00,12543.21
// 12/27/2025,"ONLINE PMT NATIONAL GRID",-185.32,12993.21

function parseDate(dateStr: string): Date | null {
  // Format: MM/DD/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const month = parseInt(match[1], 10) - 1 // 0-indexed
  const day = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  const date = new Date(year, month, day)
  if (isNaN(date.getTime())) return null

  return date
}

function parseAmount(amountStr: string): number | null {
  // Remove commas and dollar signs, parse as float
  const cleaned = amountStr.replace(/[$,]/g, '').trim()
  const amount = parseFloat(cleaned)
  return isNaN(amount) ? null : amount
}

function extractCheckNumber(description: string): string | null {
  // Look for patterns like "Check 1234", "CHK 5678", "CHECK #9012"
  const patterns = [
    /\bCheck\s*#?\s*(\d+)/i,
    /\bChk\s*#?\s*(\d+)/i,
    /\bCHECK\s*#?\s*(\d+)/i,
    /\bBill Pay Check\s+(\d+):/i,  // "Bill Pay Check 7151: Vendor"
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

// Categorize transaction type for filtering and matching
function categorizeTransaction(description: string, amount: number): TransactionCategory {
  const desc = description.toUpperCase()

  // Check payments
  if (/^CHECK\s+\d+$/i.test(description)) {
    return 'check'
  }

  // Bill Pay with check number
  if (/^BILL PAY CHECK\s+\d+:/i.test(description)) {
    return 'bill_pay_check'
  }

  // Bill Pay (direct ACH to vendor) - "Parker Construction Bill Payment"
  if (/BILL PAYMENT$/i.test(description)) {
    return 'bill_pay'
  }

  // Wire transfers
  if (desc.includes('WIRE TYPE:')) {
    return 'wire'
  }

  // ACH auto-pay utilities
  // Patterns: "GrMtnPower DES:GrMtnPwr", "PPL Rhode Island DES:UTIL. BILL", "Edge 11211 Condo DES:WEB PMTS"
  if (desc.includes('DES:UTIL. BILL') ||
      desc.includes('DES:GRMTNPWR') ||
      /EDGE\s+\d+\s+CONDO/i.test(desc) ||
      // Common utility providers
      desc.includes('GRMTNPOWER') ||
      desc.includes('PPL RHODE ISLAND') ||
      desc.includes('PROVIDENCE WATER') ||
      desc.includes('VERIZON') && !desc.includes('WIRELESS') ||
      desc.includes('CON ED') ||
      desc.includes('NATIONAL GRID')) {
    return 'ach_autopay'
  }

  // Transfers
  if (desc.includes('ONLINE BANKING TRANSFER') ||
      desc.includes('ONLINE TRANSFER') ||
      /^TRANSFER\s/i.test(description)) {
    return 'transfer'
  }

  // Credit card payments (noise for bill matching)
  if (desc.includes('APPLECARD') ||
      desc.includes('AMERICAN EXPRESS') ||
      desc.includes('BARCLAYCARD') ||
      desc.includes('CITI AUTOPAY') ||
      desc.includes('CHASE CREDIT') ||
      (desc.includes('GSBANK') && desc.includes('PAYMENT'))) {
    return 'credit_card'
  }

  // Other noise
  if (desc.includes('PAYPAL') ||
      desc.includes('UBER') ||
      desc.includes('VENMO') ||
      desc.includes('INTEREST EARNED') ||
      desc.includes('INTEREST PAYMENT') ||
      desc.includes('PREFERRED REWARDS') ||
      desc.includes('FX ORDER') ||
      desc.includes('CLARK FINE ART')) {
    return 'noise'
  }

  return 'other'
}

// Extract vendor name from description for matching
function extractVendorName(description: string): string | null {
  // Bill Pay format: "Parker Construction Bill Payment"
  const billPayMatch = description.match(/^(.+?)\s+Bill Payment$/i)
  if (billPayMatch) return billPayMatch[1].trim()

  // Bill Pay Check format: "Bill Pay Check 7151: Ocean State Elec. Sec. Syst.,I"
  const billPayCheckMatch = description.match(/Bill Pay Check\s+\d+:\s*(.+)$/i)
  if (billPayCheckMatch) return billPayCheckMatch[1].trim()

  // ACH/utility format: "GrMtnPower DES:GrMtnPwr"
  const achMatch = description.match(/^([A-Za-z0-9\s]+?)\s+DES:/i)
  if (achMatch) return achMatch[1].trim()

  // HOA format: "Edge 11211 Condo DES:WEB PMTS"
  const hoaMatch = description.match(/^(Edge\s+\d+\s+Condo)/i)
  if (hoaMatch) return hoaMatch[1]

  return null
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current.trim())
  return fields
}

function detectAccountType(lines: string[]): string | null {
  // Look for account type in header rows
  for (const line of lines.slice(0, 10)) {
    const lower = line.toLowerCase()
    if (lower.includes('checking')) return 'checking'
    if (lower.includes('savings')) return 'savings'
    if (lower.includes('credit card') || lower.includes('credit')) return 'credit'
    if (lower.includes('money market')) return 'money_market'
  }
  return null
}

function findDataStartRow(lines: string[]): number {
  // Look for the header row containing "Date", "Description", "Amount"
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes('date') && lower.includes('description') && lower.includes('amount')) {
      return i + 1 // Data starts on the next row
    }
  }
  // If no header found, try starting from row 0
  return 0
}

export function parseBoACSV(csvContent: string): ParseResult {
  const stats = {
    total: 0,
    debits: 0,
    credits: 0,
    checks: 0,
    billPay: 0,
    achAutopay: 0,
    wires: 0,
    transfers: 0,
    creditCards: 0,
    noise: 0,
    other: 0
  }

  const result: ParseResult = {
    transactions: [],
    dateRangeStart: null,
    dateRangeEnd: null,
    accountType: null,
    errors: [],
    stats
  }

  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  if (lines.length === 0) {
    result.errors.push('Empty CSV file')
    return result
  }

  // Detect account type from header
  result.accountType = detectAccountType(lines)

  // Find where data starts
  const dataStartRow = findDataStartRow(lines)

  // Parse transactions
  for (let i = dataStartRow; i < lines.length; i++) {
    const line = lines[i]
    const fields = parseCSVLine(line)

    // Expect at least 3 fields: Date, Description, Amount
    if (fields.length < 3) {
      continue
    }

    const date = parseDate(fields[0])
    if (!date) {
      // Skip non-data rows
      continue
    }

    const description = fields[1]

    // Skip "Beginning balance" row
    if (description?.toLowerCase().includes('beginning balance')) {
      continue
    }

    const amount = parseAmount(fields[2])

    if (amount === null) {
      result.errors.push(`Invalid amount on row ${i + 1}: ${fields[2]}`)
      continue
    }

    const runningBalance = fields.length >= 4 ? parseAmount(fields[3]) : null
    const checkNumber = extractCheckNumber(description)
    const category = categorizeTransaction(description, amount)
    const extractedVendorName = extractVendorName(description)
    const isDebit = amount < 0

    result.transactions.push({
      date,
      description,
      amount,
      checkNumber,
      runningBalance,
      category,
      extractedVendorName,
      isDebit
    })

    // Update stats
    stats.total++
    if (isDebit) {
      stats.debits++
    } else {
      stats.credits++
    }

    switch (category) {
      case 'check':
      case 'bill_pay_check':
        stats.checks++
        break
      case 'bill_pay':
        stats.billPay++
        break
      case 'ach_autopay':
        stats.achAutopay++
        break
      case 'wire':
        stats.wires++
        break
      case 'transfer':
        stats.transfers++
        break
      case 'credit_card':
        stats.creditCards++
        break
      case 'noise':
        stats.noise++
        break
      default:
        stats.other++
    }
  }

  // Sort transactions by date (newest first)
  result.transactions.sort((a, b) => b.date.getTime() - a.date.getTime())

  // Calculate date range
  if (result.transactions.length > 0) {
    result.dateRangeStart = result.transactions[result.transactions.length - 1].date
    result.dateRangeEnd = result.transactions[0].date
  }

  return result
}

// Get transactions that could potentially match bills (debits only, excluding noise)
export function getMatchableTransactions(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const matchableCategories: TransactionCategory[] = ['check', 'bill_pay', 'bill_pay_check', 'ach_autopay']
  return transactions.filter(t =>
    t.isDebit &&
    matchableCategories.includes(t.category)
  )
}

// Generate a hash for transaction deduplication
export function generateTransactionHash(t: ParsedTransaction): string {
  const key = `${t.date.toISOString().split('T')[0]}|${t.description}|${t.amount}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// Validate that the CSV looks like a Bank of America export
export function validateBoACSV(csvContent: string): { valid: boolean; error?: string } {
  if (!csvContent || csvContent.trim().length === 0) {
    return { valid: false, error: 'File is empty' }
  }

  const lines = csvContent.split('\n').filter(line => line.trim().length > 0)

  if (lines.length < 2) {
    return { valid: false, error: 'File has no data rows' }
  }

  // Check for expected headers or date patterns
  let hasDateColumn = false
  let hasAmountColumn = false

  for (const line of lines.slice(0, 10)) {
    const lower = line.toLowerCase()
    if (lower.includes('date')) hasDateColumn = true
    if (lower.includes('amount')) hasAmountColumn = true

    // Check for date pattern in data rows
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(line)) {
      hasDateColumn = true
    }
  }

  if (!hasDateColumn || !hasAmountColumn) {
    return { valid: false, error: 'File does not appear to be a Bank of America transaction export. Expected Date and Amount columns.' }
  }

  return { valid: true }
}
