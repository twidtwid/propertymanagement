import { query } from "@/lib/db"
import type { PaymentSuggestion, PaymentSuggestionConfidence, Vendor, Property } from "@/types/database"

// Keywords indicating payment-related emails
const PAYMENT_KEYWORDS = [
  'invoice', 'statement', 'bill', 'payment due', 'amount due',
  'balance due', 'pay by', 'due date', 'remittance', 'payable',
  'autopay', 'auto-pay', 'scheduled payment', 'will be charged'
]

// Keywords for receipts/confirmations (not suggestions - payment already made)
const RECEIPT_KEYWORDS = [
  'payment received', 'thank you for your payment', 'payment confirmed',
  'payment successful', 'receipt', 'paid in full'
]

// Regex patterns for extracting amounts
const AMOUNT_PATTERNS = [
  /\$\s*([\d,]+\.?\d{0,2})/g,                    // $1,234.56
  /(?:amount|total|due|balance)[:\s]*\$?([\d,]+\.?\d{0,2})/gi,  // Amount: 1234.56
  /(?:USD|US\$)\s*([\d,]+\.?\d{0,2})/g,          // USD 1234.56
]

// Regex patterns for extracting due dates
const DATE_PATTERNS = [
  /(?:due|by|before|on)\s*(?:date)?[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
  /(?:due|by|before|on)\s*(?:date)?[:\s]*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{2,4})/gi,
  /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s*(?:due|deadline)/gi,
]

interface EmailForAnalysis {
  id: string
  gmail_message_id: string
  vendor_id: string | null
  vendor_name: string | null
  subject: string | null
  body_snippet: string | null
  body_html: string | null
  received_at: string
}

interface ExtractedPaymentInfo {
  amount: number | null
  due_date: string | null
  signals: string[]
  is_receipt: boolean
}

/**
 * Extract payment information from email text
 */
function extractPaymentInfo(subject: string | null, body: string | null): ExtractedPaymentInfo {
  const text = [subject, body].filter(Boolean).join(' ').toLowerCase()
  const signals: string[] = []
  let is_receipt = false

  // Check for receipt keywords first (these are not suggestions)
  for (const keyword of RECEIPT_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      is_receipt = true
      break
    }
  }

  // Check for payment keywords
  for (const keyword of PAYMENT_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      signals.push('payment_keyword')
      break
    }
  }

  // Extract amount
  let amount: number | null = null
  const originalText = [subject, body].filter(Boolean).join(' ')

  for (const pattern of AMOUNT_PATTERNS) {
    let match: RegExpExecArray | null
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0
    while ((match = pattern.exec(originalText)) !== null) {
      const parsed = parseFloat(match[1].replace(/,/g, ''))
      // Take the first reasonable amount (between $1 and $100,000)
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 100000) {
        amount = parsed
        signals.push('amount_found')
        break
      }
    }
    if (amount) break
  }

  // Extract due date
  let due_date: string | null = null
  for (const pattern of DATE_PATTERNS) {
    const match = originalText.match(pattern)
    if (match && match[1]) {
      const parsed = parseDate(match[1])
      if (parsed) {
        due_date = parsed
        signals.push('due_date_found')
        break
      }
    }
  }

  return { amount, due_date, signals, is_receipt }
}

/**
 * Parse various date formats into ISO date string
 */
function parseDate(dateStr: string): string | null {
  try {
    let date: Date | null = null

    // Try MM/DD/YYYY or MM-DD-YYYY format first (US format)
    const usDateMatch = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
    if (usDateMatch) {
      const month = parseInt(usDateMatch[1], 10)
      const day = parseInt(usDateMatch[2], 10)
      const year = parseInt(usDateMatch[3], 10)
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        date = new Date(year, month - 1, day)
      }
    }

    // Fall back to standard date parsing
    if (!date) {
      date = new Date(dateStr)
    }

    if (!isNaN(date.getTime())) {
      // Only accept dates within reasonable range (past 30 days to next 2 years)
      const now = new Date()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const twoYearsLater = new Date()
      twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2)

      if (date >= thirtyDaysAgo && date <= twoYearsLater) {
        return date.toISOString().split('T')[0]
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return null
}

/**
 * Calculate confidence level based on signals
 */
function calculateConfidence(signals: string[], hasVendorMatch: boolean): PaymentSuggestionConfidence {
  let score = 0

  if (signals.includes('payment_keyword')) score += 1
  if (signals.includes('amount_found')) score += 2
  if (signals.includes('due_date_found')) score += 1
  if (hasVendorMatch) score += 1

  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

/**
 * Scan recent emails for payment suggestions
 */
export async function scanEmailsForPaymentSuggestions(
  daysBack: number = 14,
  onlyHighMedium: boolean = true
): Promise<number> {
  // Get recent vendor emails that haven't been processed yet
  const emails = await query<EmailForAnalysis>(`
    SELECT
      vc.id,
      vc.gmail_message_id,
      vc.vendor_id,
      v.name as vendor_name,
      vc.subject,
      vc.body_snippet,
      vc.body_html,
      vc.received_at
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.direction = 'inbound'
      AND vc.vendor_id IS NOT NULL
      AND vc.received_at >= CURRENT_DATE - ($1::INTEGER)
      AND NOT EXISTS (
        SELECT 1 FROM payment_suggestions ps
        WHERE ps.email_id = vc.id OR ps.gmail_message_id = vc.gmail_message_id
      )
      AND NOT (vc.labels && ARRAY['CATEGORY_PROMOTIONS', 'SPAM']::text[])
    ORDER BY vc.received_at DESC
    LIMIT 100
  `, [daysBack])

  let suggestionsCreated = 0

  for (const email of emails) {
    // Use body_snippet, or strip HTML tags from body_html as fallback
    const bodyText = email.body_snippet ||
      (email.body_html ? email.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500) : null)

    const { amount, due_date, signals, is_receipt } = extractPaymentInfo(
      email.subject,
      bodyText
    )

    // Skip receipts (payment already made)
    if (is_receipt) continue

    // Skip if no payment signals found
    if (signals.length === 0) continue

    // Add vendor match signal if we have a vendor
    if (email.vendor_id) {
      signals.push('vendor_matched')
    }

    const confidence = calculateConfidence(signals, !!email.vendor_id)

    // Skip low confidence if only high/medium requested
    if (onlyHighMedium && confidence === 'low') continue

    // Insert suggestion
    await query(`
      INSERT INTO payment_suggestions (
        email_id, gmail_message_id, vendor_id, vendor_name_extracted,
        amount_extracted, due_date_extracted, confidence, signals,
        email_subject, email_snippet, email_received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (email_id) DO NOTHING
    `, [
      email.id,
      email.gmail_message_id,
      email.vendor_id,
      email.vendor_name,
      amount,
      due_date,
      confidence,
      signals,
      email.subject,
      email.body_snippet,
      email.received_at
    ])

    suggestionsCreated++
  }

  return suggestionsCreated
}

/**
 * Get pending payment suggestions for review.
 * Excludes invoice emails that already have a matching auto-pay bill
 * (same vendor, similar amount, confirmed within 14 days).
 */
export async function getPendingPaymentSuggestions(): Promise<PaymentSuggestion[]> {
  return query<PaymentSuggestion>(`
    SELECT
      ps.*,
      v.name as vendor_name,
      v.id as vendor_id,
      p.name as property_name
    FROM payment_suggestions ps
    LEFT JOIN vendors v ON ps.vendor_id = v.id
    LEFT JOIN properties p ON ps.property_id = p.id
    WHERE ps.status = 'pending_review'
      AND ps.confidence IN ('high', 'medium')
      AND ps.vendor_id IS NOT NULL
      -- Exclude invoice emails that match an existing auto-pay bill
      AND NOT EXISTS (
        SELECT 1 FROM bills b
        WHERE b.vendor_id = ps.vendor_id
          AND b.payment_method = 'auto_pay'
          AND b.status = 'confirmed'
          -- Amount matches within $1 or 1%
          AND (
            ABS(b.amount - COALESCE(ps.amount_extracted, 0)) < 1.00
            OR ABS(b.amount - COALESCE(ps.amount_extracted, 0)) < b.amount * 0.01
          )
          -- Bill confirmed within 14 days of the email
          AND b.confirmation_date >= (ps.email_received_at::date - 14)
          AND b.confirmation_date <= (ps.email_received_at::date + 14)
      )
    ORDER BY
      CASE ps.confidence
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      ps.email_received_at DESC
    LIMIT 20
  `)
}

/**
 * Get count of pending suggestions by confidence.
 * Excludes invoice emails that already have a matching auto-pay bill.
 */
export async function getPaymentSuggestionCounts(): Promise<{ high: number; medium: number; total: number }> {
  const result = await query<{ confidence: PaymentSuggestionConfidence; count: string }>(`
    SELECT confidence, COUNT(*) as count
    FROM payment_suggestions ps
    WHERE status = 'pending_review'
      AND confidence IN ('high', 'medium')
      AND vendor_id IS NOT NULL
      -- Exclude invoice emails that match an existing auto-pay bill
      AND NOT EXISTS (
        SELECT 1 FROM bills b
        WHERE b.vendor_id = ps.vendor_id
          AND b.payment_method = 'auto_pay'
          AND b.status = 'confirmed'
          AND (
            ABS(b.amount - COALESCE(ps.amount_extracted, 0)) < 1.00
            OR ABS(b.amount - COALESCE(ps.amount_extracted, 0)) < b.amount * 0.01
          )
          AND b.confirmation_date >= (ps.email_received_at::date - 14)
          AND b.confirmation_date <= (ps.email_received_at::date + 14)
      )
    GROUP BY confidence
  `)

  const counts = { high: 0, medium: 0, total: 0 }
  for (const row of result) {
    const count = parseInt(row.count, 10)
    if (row.confidence === 'high') counts.high = count
    if (row.confidence === 'medium') counts.medium = count
    counts.total += count
  }
  return counts
}

/**
 * Mark a suggestion as dismissed
 */
export async function dismissPaymentSuggestion(
  suggestionId: string,
  userId: string
): Promise<void> {
  await query(`
    UPDATE payment_suggestions
    SET status = 'dismissed', reviewed_at = NOW(), reviewed_by = $2
    WHERE id = $1
  `, [suggestionId, userId])
}

/**
 * Mark a suggestion as imported (with bill link)
 */
export async function markSuggestionImported(
  suggestionId: string,
  billId: string,
  userId: string
): Promise<void> {
  await query(`
    UPDATE payment_suggestions
    SET status = 'imported', imported_bill_id = $2, reviewed_at = NOW(), reviewed_by = $3
    WHERE id = $1
  `, [suggestionId, billId, userId])
}
