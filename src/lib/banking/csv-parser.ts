// Bank of America CSV Parser
// Parses CSV transaction files downloaded from Bank of America

export interface ParsedTransaction {
  date: Date
  description: string
  amount: number  // Negative = debit (payment out), Positive = credit
  checkNumber: string | null
  runningBalance: number | null
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  dateRangeStart: Date | null
  dateRangeEnd: Date | null
  accountType: string | null
  errors: string[]
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
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      return match[1]
    }
  }

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
  const result: ParseResult = {
    transactions: [],
    dateRangeStart: null,
    dateRangeEnd: null,
    accountType: null,
    errors: []
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
    const amount = parseAmount(fields[2])

    if (amount === null) {
      result.errors.push(`Invalid amount on row ${i + 1}: ${fields[2]}`)
      continue
    }

    const runningBalance = fields.length >= 4 ? parseAmount(fields[3]) : null
    const checkNumber = extractCheckNumber(description)

    result.transactions.push({
      date,
      description,
      amount,
      checkNumber,
      runningBalance
    })
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
