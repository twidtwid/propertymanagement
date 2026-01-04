import { query } from "@/lib/db"
import type { PaymentEmailLink, PaymentSourceType, PaymentEmailLinkType } from "@/types/database"
import type { VendorCommunication } from "@/types/gmail"

// Keywords indicating payment confirmation emails
const CONFIRMATION_KEYWORDS = [
  'payment received', 'payment confirmed', 'payment successful',
  'payment processed', 'thank you for your payment', 'payment complete',
  'auto-pay processed', 'automatic payment', 'has been paid',
  'transaction complete', 'payment notification', 'autopay payment confirmation'
]

// Keywords indicating invoices/statements
const INVOICE_KEYWORDS = [
  'invoice', 'statement', 'bill', 'amount due', 'payment due',
  'balance due', 'please pay', 'remittance'
]

interface EmailForMatching {
  id: string
  vendor_id: string | null
  vendor_name: string | null
  subject: string | null
  body_snippet: string | null
  received_at: string
  amount_extracted: number | null
}

interface PaymentForMatching {
  id: string
  payment_type: PaymentSourceType
  vendor_id: string | null
  amount: number
  due_date: string
  description: string
}

/**
 * Detect if an email is a confirmation email
 */
function isConfirmationEmail(subject: string | null, body: string | null): boolean {
  const text = [subject, body].filter(Boolean).join(' ').toLowerCase()
  return CONFIRMATION_KEYWORDS.some(keyword => text.includes(keyword))
}

/**
 * Detect if an email is an invoice/statement
 */
function isInvoiceEmail(subject: string | null, body: string | null): boolean {
  const text = [subject, body].filter(Boolean).join(' ').toLowerCase()
  return INVOICE_KEYWORDS.some(keyword => text.includes(keyword))
}

/**
 * Extract amount from email text
 */
function extractAmount(text: string): number | null {
  const patterns = [
    /\$\s*([\d,]+\.?\d{0,2})/g,
    /(?:amount|total|payment)[:\s]*\$?([\d,]+\.?\d{0,2})/gi,
  ]

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 100000) {
        return parsed
      }
    }
  }
  return null
}

/**
 * Calculate match confidence between email and payment
 */
function calculateMatchConfidence(
  email: EmailForMatching,
  payment: PaymentForMatching
): number {
  let score = 0

  // Vendor match (high weight)
  if (email.vendor_id && email.vendor_id === payment.vendor_id) {
    score += 0.4
  }

  // Amount match (high weight)
  const emailAmount = email.amount_extracted ||
    extractAmount([email.subject, email.body_snippet].filter(Boolean).join(' '))
  if (emailAmount && Math.abs(emailAmount - payment.amount) < 0.01) {
    score += 0.4
  } else if (emailAmount && Math.abs(emailAmount - payment.amount) < 1.00) {
    score += 0.2
  }

  // Date proximity (medium weight)
  const emailDate = new Date(email.received_at)
  const paymentDate = new Date(payment.due_date)
  const daysDiff = Math.abs((emailDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff <= 3) {
    score += 0.2
  } else if (daysDiff <= 7) {
    score += 0.1
  }

  return Math.min(score, 1.0)
}

/**
 * Auto-match recent emails to existing payments
 */
export async function autoMatchEmailsToPayments(
  daysBack: number = 7,
  minConfidence: number = 0.7
): Promise<number> {
  // Get recent vendor emails that aren't already linked
  const emails = await query<EmailForMatching>(`
    SELECT
      vc.id, vc.vendor_id, v.name as vendor_name,
      vc.subject, vc.body_snippet, vc.received_at,
      NULL as amount_extracted
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.direction = 'inbound'
      AND vc.received_at >= CURRENT_DATE - $1
      AND NOT EXISTS (
        SELECT 1 FROM payment_email_links pel WHERE pel.email_id = vc.id
      )
    ORDER BY vc.received_at DESC
    LIMIT 100
  `, [daysBack])

  // Get recent payments that could be matched
  const payments = await query<PaymentForMatching>(`
    SELECT id, 'bill' as payment_type, vendor_id, amount, due_date, description
    FROM bills
    WHERE due_date >= CURRENT_DATE - $1
      AND status IN ('confirmed', 'sent', 'pending')
    UNION ALL
    SELECT id, 'property_tax' as payment_type, NULL as vendor_id, amount, due_date,
           jurisdiction || ' ' || tax_year || ' Q' || installment as description
    FROM property_taxes
    WHERE due_date >= CURRENT_DATE - $1
  `, [daysBack + 30])

  let linksCreated = 0

  for (const email of emails) {
    const isConfirmation = isConfirmationEmail(email.subject, email.body_snippet)
    const isInvoice = isInvoiceEmail(email.subject, email.body_snippet)

    if (!isConfirmation && !isInvoice) continue

    // Find best matching payment
    let bestMatch: { payment: PaymentForMatching; confidence: number } | null = null

    for (const payment of payments) {
      const confidence = calculateMatchConfidence(email, payment)
      if (confidence >= minConfidence) {
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { payment, confidence }
        }
      }
    }

    if (bestMatch) {
      const linkType: PaymentEmailLinkType = isConfirmation ? 'confirmation' : 'invoice'

      await query(`
        INSERT INTO payment_email_links (payment_type, payment_id, email_id, link_type, confidence, auto_matched)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (payment_type, payment_id, email_id) DO NOTHING
      `, [
        bestMatch.payment.payment_type,
        bestMatch.payment.id,
        email.id,
        linkType,
        bestMatch.confidence
      ])

      linksCreated++
    }
  }

  return linksCreated
}

/**
 * Create bills from confirmation emails for known vendors.
 * This handles auto-pay confirmations where the vendor sends a "payment received" email.
 */
export async function createBillsFromConfirmationEmails(
  daysBack: number = 14
): Promise<number> {
  // Get confirmation emails from known vendors that aren't already linked
  const emails = await query<{
    id: string
    vendor_id: string
    vendor_name: string
    subject: string | null
    body_snippet: string | null
    received_at: string
  }>(`
    SELECT
      vc.id, vc.vendor_id, v.name as vendor_name,
      vc.subject, vc.body_snippet, vc.received_at
    FROM vendor_communications vc
    JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.direction = 'inbound'
      AND vc.vendor_id IS NOT NULL
      AND vc.received_at >= CURRENT_DATE - ($1::INTEGER)
      AND NOT EXISTS (
        SELECT 1 FROM payment_email_links pel WHERE pel.email_id = vc.id
      )
    ORDER BY vc.received_at DESC
    LIMIT 100
  `, [daysBack])

  let billsCreated = 0

  for (const email of emails) {
    // Only process confirmation emails
    if (!isConfirmationEmail(email.subject, email.body_snippet)) {
      continue
    }

    // Extract amount from email
    const text = [email.subject, email.body_snippet].filter(Boolean).join(' ')
    const amount = extractAmount(text)

    if (!amount) {
      continue // Can't create bill without amount
    }

    // Generate description from subject
    let description = email.subject || `Payment to ${email.vendor_name}`
    // Clean up common prefixes
    description = description
      .replace(/^(Payment\s*[-–]\s*)/i, '')
      .replace(/^(Your payment has been received)\s*[-–]?\s*/i, '')
      .replace(/^(Payment confirmation:?\s*)/i, '')
      .trim()

    // If description is generic, use vendor name
    if (description.toLowerCase() === 'your payment has been received' ||
        description.toLowerCase().includes('autopay payment confirmation')) {
      description = `${email.vendor_name} - Auto Pay`
    }

    // Create the bill
    const billResult = await query<{ id: string }>(`
      INSERT INTO bills (
        vendor_id,
        amount,
        due_date,
        payment_date,
        confirmation_date,
        description,
        status,
        payment_method,
        bill_type
      ) VALUES (
        $1, $2, $3::date, $3::date, $3::date, $4, 'confirmed', 'auto_pay', 'other'
      )
      RETURNING id
    `, [
      email.vendor_id,
      amount,
      email.received_at.split('T')[0], // Use email date as due/payment date
      description
    ])

    if (billResult.length > 0) {
      // Link the email to the new bill
      await query(`
        INSERT INTO payment_email_links (payment_type, payment_id, email_id, link_type, confidence, auto_matched)
        VALUES ('bill', $1, $2, 'confirmation', 1.0, true)
        ON CONFLICT (payment_type, payment_id, email_id) DO NOTHING
      `, [billResult[0].id, email.id])

      billsCreated++
    }
  }

  return billsCreated
}

/**
 * Get linked emails for a payment
 */
export async function getLinkedEmails(
  paymentType: PaymentSourceType,
  paymentId: string
): Promise<(PaymentEmailLink & { email: VendorCommunication })[]> {
  return query(`
    SELECT
      pel.*,
      vc.id as "email.id",
      vc.vendor_id as "email.vendor_id",
      vc.subject as "email.subject",
      vc.body_snippet as "email.body_snippet",
      vc.body_html as "email.body_html",
      vc.received_at as "email.received_at",
      vc.gmail_message_id as "email.gmail_message_id",
      v.name as "email.vendor_name"
    FROM payment_email_links pel
    JOIN vendor_communications vc ON pel.email_id = vc.id
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE pel.payment_type = $1 AND pel.payment_id = $2
    ORDER BY vc.received_at DESC
  `, [paymentType, paymentId])
}

/**
 * Get all payments with linked emails (for batch loading)
 */
export async function getPaymentsWithLinkedEmails(
  paymentType: PaymentSourceType,
  paymentIds: string[]
): Promise<Map<string, (PaymentEmailLink & { email: VendorCommunication })[]>> {
  if (paymentIds.length === 0) return new Map()

  const links = await query<PaymentEmailLink & { email: VendorCommunication }>(`
    SELECT
      pel.*,
      vc.id as "email.id",
      vc.vendor_id as "email.vendor_id",
      vc.subject as "email.subject",
      vc.body_snippet as "email.body_snippet",
      vc.body_html as "email.body_html",
      vc.received_at as "email.received_at",
      v.name as "email.vendor_name"
    FROM payment_email_links pel
    JOIN vendor_communications vc ON pel.email_id = vc.id
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE pel.payment_type = $1 AND pel.payment_id = ANY($2)
    ORDER BY vc.received_at DESC
  `, [paymentType, paymentIds])

  const map = new Map<string, (PaymentEmailLink & { email: VendorCommunication })[]>()
  for (const link of links) {
    const existing = map.get(link.payment_id) || []
    existing.push(link)
    map.set(link.payment_id, existing)
  }
  return map
}

/**
 * Manually link an email to a payment
 */
export async function linkEmailToPayment(
  paymentType: PaymentSourceType,
  paymentId: string,
  emailId: string,
  linkType: PaymentEmailLinkType,
  userId?: string
): Promise<PaymentEmailLink> {
  const result = await query<PaymentEmailLink>(`
    INSERT INTO payment_email_links (payment_type, payment_id, email_id, link_type, confidence, auto_matched, created_by)
    VALUES ($1, $2, $3, $4, 1.00, false, $5)
    ON CONFLICT (payment_type, payment_id, email_id)
    DO UPDATE SET link_type = $4, created_by = $5
    RETURNING *
  `, [paymentType, paymentId, emailId, linkType, userId])

  return result[0]
}

/**
 * Remove a link between email and payment
 */
export async function unlinkEmailFromPayment(
  paymentType: PaymentSourceType,
  paymentId: string,
  emailId: string
): Promise<void> {
  await query(`
    DELETE FROM payment_email_links
    WHERE payment_type = $1 AND payment_id = $2 AND email_id = $3
  `, [paymentType, paymentId, emailId])
}

/**
 * Get recently processed auto-pays with confirmation emails
 */
export async function getRecentAutoPayConfirmations(
  daysBack: number = 7,
  limit: number = 10
): Promise<Array<{
  payment_id: string
  payment_type: PaymentSourceType
  description: string
  amount: number
  property_name: string | null
  vendor_name: string | null
  confirmation_date: string
  email_subject: string
  email_snippet: string | null
}>> {
  return query(`
    SELECT
      b.id as payment_id,
      'bill'::text as payment_type,
      b.description,
      b.amount,
      p.name as property_name,
      v.name as vendor_name,
      vc.received_at as confirmation_date,
      vc.subject as email_subject,
      vc.body_snippet as email_snippet
    FROM payment_email_links pel
    JOIN bills b ON pel.payment_id = b.id AND pel.payment_type = 'bill'
    JOIN vendor_communications vc ON pel.email_id = vc.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN vendors v ON b.vendor_id = v.id
    WHERE pel.link_type = 'confirmation'
      AND vc.received_at >= CURRENT_DATE - $1
      AND b.payment_method = 'auto_pay'
    ORDER BY vc.received_at DESC
    LIMIT $2
  `, [daysBack, limit])
}
