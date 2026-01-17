import { query } from "@/lib/db"
import type { PaymentSuggestion, PaymentSuggestionConfidence } from "@/types/database"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

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

interface AIPaymentAnalysis {
  isPaymentRequest: boolean
  amount: number | null
  dueDate: string | null  // ISO date format YYYY-MM-DD
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

/**
 * Use AI (Haiku) to analyze if an email is a payment request and extract details.
 * More accurate than keyword matching - filters out false positives like key returns,
 * delivery confirmations, marketing emails, etc.
 */
async function analyzeEmailForPayment(
  subject: string | null,
  bodySnippet: string | null,
  bodyHtml: string | null,
  vendorName: string | null
): Promise<AIPaymentAnalysis> {
  try {
    // Strip HTML tags for cleaner analysis
    const cleanBody = bodyHtml
      ? bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 3000)
      : bodySnippet || ''

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You analyze vendor emails to identify payment requests (invoices, bills, statements requiring payment).

INCLUDE: Invoices, bills, statements with amounts due, utility bills, service invoices, autopay notifications for upcoming charges.

EXCLUDE: Payment confirmations/receipts (already paid), key returns, package deliveries, building notices, marketing emails, account updates without payment requests, service notifications without bills.

Be strict - only flag emails that clearly request payment for a specific amount. Output JSON only.`,
      messages: [{
        role: "user",
        content: `Vendor: ${vendorName || 'Unknown'}
Subject: ${subject || '(no subject)'}
Body: ${cleanBody}

Is this a payment request (invoice/bill that needs to be paid)?
If yes, extract amount and due date.

Output ONLY valid JSON:
{"isPaymentRequest": boolean, "amount": number or null, "dueDate": "YYYY-MM-DD or null", "confidence": "high/medium/low", "reason": "brief reason"}`
      }]
    }, {
      timeout: 10000 // 10 second timeout
    })

    const text = response.content[0]
    if (text.type === "text") {
      const jsonMatch = text.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return {
          isPaymentRequest: result.isPaymentRequest === true,
          amount: typeof result.amount === 'number' ? result.amount : null,
          dueDate: result.dueDate || null,
          confidence: result.confidence || 'low',
          reason: result.reason || ''
        }
      }
    }
  } catch (error: any) {
    console.error("[PaymentSuggestions] AI analysis error:", error.message)
  }

  // Default to not a payment request on error
  return {
    isPaymentRequest: false,
    amount: null,
    dueDate: null,
    confidence: 'low',
    reason: 'AI analysis failed'
  }
}

/**
 * Scan recent emails for payment suggestions using AI analysis.
 * Only processes emails from known vendors to keep API costs low.
 * Uses payment_analyzed_at to track analyzed emails and prevent re-analysis.
 */
export async function scanEmailsForPaymentSuggestions(
  daysBack: number = 14,
  onlyHighMedium: boolean = true
): Promise<number> {
  // Get recent vendor emails that haven't been analyzed yet
  // Only emails from known vendors (vendor_id IS NOT NULL) are analyzed
  // Uses payment_analyzed_at to prevent re-analyzing the same emails
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
      AND vc.payment_analyzed_at IS NULL
      AND NOT (vc.labels && ARRAY['CATEGORY_PROMOTIONS', 'SPAM']::text[])
    ORDER BY vc.received_at DESC
    LIMIT 50
  `, [daysBack])

  let suggestionsCreated = 0

  for (const email of emails) {
    // Use AI to analyze if this is a payment request
    const analysis = await analyzeEmailForPayment(
      email.subject,
      email.body_snippet,
      email.body_html,
      email.vendor_name
    )

    // Mark email as analyzed (whether it's a payment request or not)
    // This prevents re-analyzing the same email repeatedly
    await query(`
      UPDATE vendor_communications
      SET payment_analyzed_at = NOW()
      WHERE id = $1
    `, [email.id])

    // Skip if AI determined this is not a payment request
    if (!analysis.isPaymentRequest) {
      continue
    }

    // Skip low confidence if only high/medium requested
    if (onlyHighMedium && analysis.confidence === 'low') {
      continue
    }

    // Build signals array for backward compatibility
    const signals: string[] = ['ai_analyzed', 'vendor_matched']
    if (analysis.amount) signals.push('amount_found')
    if (analysis.dueDate) signals.push('due_date_found')

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
      analysis.amount,
      analysis.dueDate,
      analysis.confidence,
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
