/**
 * Alert Generation System
 *
 * Generates alerts for:
 * - Overdue bills and property taxes
 * - Bills/taxes due soon (with smart amount-based thresholds)
 * - Unconfirmed checks (14+ days)
 * - Expiring/expired insurance policies
 * - Expiring/expired vehicle registrations and inspections
 * - Urgent vendor emails (received in last 24 hours)
 *
 * Features:
 * - Deduplication via entity_key
 * - Auto-resolution when conditions no longer apply
 * - Property visibility enforcement
 * - Smart thresholds based on amount
 */

import { query } from "@/lib/db"
import { getVisibilityContext } from "@/lib/visibility"

// Alert severity levels
type AlertSeverity = "info" | "warning" | "critical"

// Alert configuration
interface AlertConfig {
  alertType: string
  title: string
  message: string
  severity: AlertSeverity
  relatedTable: string
  relatedId: string
  entityKey: string
  sourceAmount?: number
  actionUrl?: string
  actionLabel?: string
}

// Smart threshold: more lead time for larger amounts
function getLeadDaysForAmount(amount: number): number {
  if (amount >= 5000) return 30
  if (amount >= 1000) return 14
  return 7
}

// Format currency for messages
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format relative time
function formatDaysUntil(days: number): string {
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days < 0) return `${Math.abs(days)} days overdue`
  return `in ${days} days`
}

export async function generateAlerts(): Promise<{
  created: number
  resolved: number
  errors: string[]
}> {
  const results = { created: 0, resolved: 0, errors: [] as string[] }

  try {
    // Get visibility context for filtering (null = system-wide, sees all)
    const ctx = await getVisibilityContext()
    const visiblePropertyIds = ctx?.visiblePropertyIds || []
    const hasVisibilityRestrictions = visiblePropertyIds.length > 0

    // Generate all alert types
    const alertConfigs: AlertConfig[] = []

    // 1. Property Taxes - Overdue
    const overdueTaxes = await query<{
      id: string
      property_name: string
      jurisdiction: string
      amount: number
      due_date: Date
      days_overdue: number
    }>(`
      SELECT
        pt.id,
        p.name as property_name,
        pt.jurisdiction,
        pt.amount,
        pt.due_date,
        (CURRENT_DATE - pt.due_date) as days_overdue
      FROM property_taxes pt
      JOIN properties p ON pt.property_id = p.id
      WHERE pt.status = 'pending'
        AND pt.due_date < CURRENT_DATE
        ${hasVisibilityRestrictions ? "AND p.id = ANY($1::uuid[])" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const tax of overdueTaxes) {
      alertConfigs.push({
        alertType: "tax_overdue",
        title: `Property Tax OVERDUE - ${tax.property_name}`,
        message: `${tax.jurisdiction} tax of ${formatCurrency(tax.amount)} was due ${formatDaysUntil(-tax.days_overdue)}`,
        severity: "critical",
        relatedTable: "property_taxes",
        relatedId: tax.id,
        entityKey: `tax_overdue:${tax.id}`,
        sourceAmount: tax.amount,
        actionUrl: "/payments/taxes",
        actionLabel: "Pay Now",
      })
    }

    // 2. Property Taxes - Due Soon (within 14 days)
    const upcomingTaxes = await query<{
      id: string
      property_name: string
      jurisdiction: string
      amount: number
      due_date: Date
      days_until: number
    }>(`
      SELECT
        pt.id,
        p.name as property_name,
        pt.jurisdiction,
        pt.amount,
        pt.due_date,
        (pt.due_date - CURRENT_DATE) as days_until
      FROM property_taxes pt
      JOIN properties p ON pt.property_id = p.id
      WHERE pt.status = 'pending'
        AND pt.due_date >= CURRENT_DATE
        AND pt.due_date <= CURRENT_DATE + 14
        ${hasVisibilityRestrictions ? "AND p.id = ANY($1::uuid[])" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const tax of upcomingTaxes) {
      alertConfigs.push({
        alertType: "tax_due_soon",
        title: `Property Tax Due Soon - ${tax.property_name}`,
        message: `${tax.jurisdiction} tax of ${formatCurrency(tax.amount)} due ${formatDaysUntil(tax.days_until)}`,
        severity: tax.days_until <= 3 ? "critical" : "warning",
        relatedTable: "property_taxes",
        relatedId: tax.id,
        entityKey: `tax_due_soon:${tax.id}`,
        sourceAmount: tax.amount,
        actionUrl: "/payments/taxes",
        actionLabel: "Pay Now",
      })
    }

    // 3. Bills - Overdue
    const overdueBills = await query<{
      id: string
      description: string
      property_name: string | null
      amount: number
      due_date: Date
      days_overdue: number
    }>(`
      SELECT
        b.id,
        b.description,
        p.name as property_name,
        b.amount,
        b.due_date,
        (CURRENT_DATE - b.due_date) as days_overdue
      FROM bills b
      LEFT JOIN properties p ON b.property_id = p.id
      WHERE b.status = 'pending'
        AND b.due_date < CURRENT_DATE
        ${hasVisibilityRestrictions ? "AND (b.property_id IS NULL OR b.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const bill of overdueBills) {
      const location = bill.property_name ? ` - ${bill.property_name}` : ""
      alertConfigs.push({
        alertType: "bill_overdue",
        title: `Bill OVERDUE${location}`,
        message: `${bill.description} (${formatCurrency(bill.amount)}) was due ${formatDaysUntil(-bill.days_overdue)}`,
        severity: "critical",
        relatedTable: "bills",
        relatedId: bill.id,
        entityKey: `bill_overdue:${bill.id}`,
        sourceAmount: bill.amount,
        actionUrl: "/payments",
        actionLabel: "Pay Now",
      })
    }

    // 4. Bills - Due Soon (smart threshold based on amount)
    const upcomingBills = await query<{
      id: string
      description: string
      property_name: string | null
      amount: number
      due_date: Date
      days_until: number
    }>(`
      SELECT
        b.id,
        b.description,
        p.name as property_name,
        b.amount,
        b.due_date,
        (b.due_date - CURRENT_DATE) as days_until
      FROM bills b
      LEFT JOIN properties p ON b.property_id = p.id
      WHERE b.status = 'pending'
        AND b.due_date >= CURRENT_DATE
        AND b.due_date <= CURRENT_DATE + 30
        ${hasVisibilityRestrictions ? "AND (b.property_id IS NULL OR b.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const bill of upcomingBills) {
      const leadDays = getLeadDaysForAmount(bill.amount)
      if (bill.days_until > leadDays) continue // Not within threshold yet

      const location = bill.property_name ? ` - ${bill.property_name}` : ""
      alertConfigs.push({
        alertType: "bill_due_soon",
        title: `Bill Due Soon${location}`,
        message: `${bill.description} (${formatCurrency(bill.amount)}) due ${formatDaysUntil(bill.days_until)}`,
        severity: bill.days_until <= 3 ? "critical" : "warning",
        relatedTable: "bills",
        relatedId: bill.id,
        entityKey: `bill_due_soon:${bill.id}`,
        sourceAmount: bill.amount,
        actionUrl: "/payments",
        actionLabel: "Pay Now",
      })
    }

    // 5. Unconfirmed Checks (14+ days since payment)
    const unconfirmedChecks = await query<{
      id: string
      description: string
      property_name: string | null
      amount: number
      payment_date: Date
      days_waiting: number
      days_to_confirm: number
    }>(`
      SELECT
        b.id,
        b.description,
        p.name as property_name,
        b.amount,
        b.payment_date,
        (CURRENT_DATE - b.payment_date) as days_waiting,
        COALESCE(b.days_to_confirm, 14) as days_to_confirm
      FROM bills b
      LEFT JOIN properties p ON b.property_id = p.id
      WHERE b.status = 'sent'
        AND b.payment_method = 'check'
        AND b.payment_date IS NOT NULL
        AND b.confirmation_date IS NULL
        AND (CURRENT_DATE - b.payment_date) >= COALESCE(b.days_to_confirm, 14)
        ${hasVisibilityRestrictions ? "AND (b.property_id IS NULL OR b.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const check of unconfirmedChecks) {
      const location = check.property_name ? ` - ${check.property_name}` : ""
      const daysOverdue = check.days_waiting - check.days_to_confirm
      alertConfigs.push({
        alertType: "check_unconfirmed",
        title: `Check Not Confirmed${location}`,
        message: `${check.description} (${formatCurrency(check.amount)}) sent ${check.days_waiting} days ago, ${daysOverdue} days past confirmation window`,
        severity: daysOverdue > 7 ? "critical" : "warning",
        relatedTable: "bills",
        relatedId: check.id,
        entityKey: `check_unconfirmed:${check.id}`,
        sourceAmount: check.amount,
        actionUrl: "/payments",
        actionLabel: "Confirm",
      })
    }

    // 6. Insurance - Expired
    const expiredInsurance = await query<{
      id: string
      policy_number: string
      carrier_name: string
      policy_type: string
      property_name: string | null
      vehicle_name: string | null
      expiration_date: Date
      days_expired: number
    }>(`
      SELECT
        ip.id,
        ip.policy_number,
        ip.carrier_name,
        ip.policy_type,
        p.name as property_name,
        CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
        ip.expiration_date,
        (CURRENT_DATE - ip.expiration_date) as days_expired
      FROM insurance_policies ip
      LEFT JOIN properties p ON ip.property_id = p.id
      LEFT JOIN vehicles v ON ip.vehicle_id = v.id
      WHERE ip.expiration_date < CURRENT_DATE
        AND ip.expiration_date > CURRENT_DATE - 90
        ${hasVisibilityRestrictions ? "AND (ip.property_id IS NULL OR ip.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const policy of expiredInsurance) {
      const asset = policy.property_name || policy.vehicle_name || "General"
      alertConfigs.push({
        alertType: "insurance_expired",
        title: `Insurance EXPIRED - ${asset}`,
        message: `${policy.carrier_name} ${policy.policy_type} policy expired ${formatDaysUntil(-policy.days_expired)}`,
        severity: "critical",
        relatedTable: "insurance_policies",
        relatedId: policy.id,
        entityKey: `insurance_expired:${policy.id}`,
        actionUrl: `/insurance/${policy.id}`,
        actionLabel: "View Policy",
      })
    }

    // 7. Insurance - Expiring Soon (within 60 days)
    const expiringInsurance = await query<{
      id: string
      policy_number: string
      carrier_name: string
      policy_type: string
      property_name: string | null
      vehicle_name: string | null
      expiration_date: Date
      days_until: number
      auto_renew: boolean
    }>(`
      SELECT
        ip.id,
        ip.policy_number,
        ip.carrier_name,
        ip.policy_type,
        p.name as property_name,
        CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
        ip.expiration_date,
        (ip.expiration_date - CURRENT_DATE) as days_until,
        ip.auto_renew
      FROM insurance_policies ip
      LEFT JOIN properties p ON ip.property_id = p.id
      LEFT JOIN vehicles v ON ip.vehicle_id = v.id
      WHERE ip.expiration_date >= CURRENT_DATE
        AND ip.expiration_date <= CURRENT_DATE + 60
        ${hasVisibilityRestrictions ? "AND (ip.property_id IS NULL OR ip.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const policy of expiringInsurance) {
      const asset = policy.property_name || policy.vehicle_name || "General"
      const autoRenewNote = policy.auto_renew ? " (auto-renew enabled)" : ""
      alertConfigs.push({
        alertType: "insurance_expiring",
        title: `Insurance Expiring - ${asset}`,
        message: `${policy.carrier_name} ${policy.policy_type} expires ${formatDaysUntil(policy.days_until)}${autoRenewNote}`,
        severity: policy.days_until <= 7 ? "critical" : "warning",
        relatedTable: "insurance_policies",
        relatedId: policy.id,
        entityKey: `insurance_expiring:${policy.id}`,
        actionUrl: `/insurance/${policy.id}`,
        actionLabel: "View Policy",
      })
    }

    // 8. Vehicle Registration - Expired
    const expiredRegistrations = await query<{
      id: string
      vehicle_name: string
      registration_expires: Date
      days_expired: number
    }>(`
      SELECT
        v.id,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_name,
        v.registration_expires,
        (CURRENT_DATE - v.registration_expires) as days_expired
      FROM vehicles v
      WHERE v.is_active = TRUE
        AND v.registration_expires < CURRENT_DATE
        ${hasVisibilityRestrictions ? "AND (v.property_id IS NULL OR v.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const vehicle of expiredRegistrations) {
      alertConfigs.push({
        alertType: "registration_expired",
        title: `Registration EXPIRED - ${vehicle.vehicle_name}`,
        message: `Vehicle registration expired ${formatDaysUntil(-vehicle.days_expired)}`,
        severity: "critical",
        relatedTable: "vehicles",
        relatedId: vehicle.id,
        entityKey: `registration_expired:${vehicle.id}`,
        actionUrl: `/vehicles/${vehicle.id}`,
        actionLabel: "View Vehicle",
      })
    }

    // 9. Vehicle Registration - Expiring Soon (within 30 days)
    const expiringRegistrations = await query<{
      id: string
      vehicle_name: string
      registration_expires: Date
      days_until: number
    }>(`
      SELECT
        v.id,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_name,
        v.registration_expires,
        (v.registration_expires - CURRENT_DATE) as days_until
      FROM vehicles v
      WHERE v.is_active = TRUE
        AND v.registration_expires >= CURRENT_DATE
        AND v.registration_expires <= CURRENT_DATE + 30
        ${hasVisibilityRestrictions ? "AND (v.property_id IS NULL OR v.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const vehicle of expiringRegistrations) {
      alertConfigs.push({
        alertType: "registration_expiring",
        title: `Registration Expiring - ${vehicle.vehicle_name}`,
        message: `Vehicle registration expires ${formatDaysUntil(vehicle.days_until)}`,
        severity: vehicle.days_until <= 7 ? "critical" : "warning",
        relatedTable: "vehicles",
        relatedId: vehicle.id,
        entityKey: `registration_expiring:${vehicle.id}`,
        actionUrl: `/vehicles/${vehicle.id}`,
        actionLabel: "View Vehicle",
      })
    }

    // 10. Vehicle Inspection - Overdue
    const overdueInspections = await query<{
      id: string
      vehicle_name: string
      inspection_expires: Date
      days_overdue: number
    }>(`
      SELECT
        v.id,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_name,
        v.inspection_expires,
        (CURRENT_DATE - v.inspection_expires) as days_overdue
      FROM vehicles v
      WHERE v.is_active = TRUE
        AND v.inspection_expires < CURRENT_DATE
        ${hasVisibilityRestrictions ? "AND (v.property_id IS NULL OR v.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const vehicle of overdueInspections) {
      alertConfigs.push({
        alertType: "inspection_overdue",
        title: `Inspection Overdue - ${vehicle.vehicle_name}`,
        message: `Vehicle inspection expired ${formatDaysUntil(-vehicle.days_overdue)}`,
        severity: "warning",
        relatedTable: "vehicles",
        relatedId: vehicle.id,
        entityKey: `inspection_overdue:${vehicle.id}`,
        actionUrl: `/vehicles/${vehicle.id}`,
        actionLabel: "View Vehicle",
      })
    }

    // 11. Urgent Vendor Emails (received in last 24 hours)
    const urgentEmails = await query<{
      id: string
      vendor_name: string
      subject: string
      received_at: Date
    }>(`
      SELECT
        vc.id,
        v.name as vendor_name,
        vc.subject,
        vc.received_at
      FROM vendor_communications vc
      INNER JOIN vendors v ON vc.vendor_id = v.id
      WHERE vc.is_important = TRUE
        AND vc.received_at >= NOW() - INTERVAL '24 hours'
    `)

    for (const email of urgentEmails) {
      alertConfigs.push({
        alertType: "urgent_vendor_email",
        title: `Urgent Email from ${email.vendor_name}`,
        message: email.subject,
        severity: "warning",
        relatedTable: "vendor_communications",
        relatedId: email.id,
        entityKey: `urgent_email:${email.id}`,
        actionUrl: "/settings/gmail",
        actionLabel: "View Email",
      })
    }

    // 12. Auto-Pay Confirmations (info - good news notifications)
    const autoPayConfirmations = await query<{
      id: string
      description: string
      property_name: string | null
      vendor_name: string | null
      amount: number
      confirmation_date: Date
      email_subject: string
    }>(`
      SELECT
        b.id,
        b.description,
        p.name as property_name,
        v.name as vendor_name,
        b.amount,
        vc.received_at as confirmation_date,
        vc.subject as email_subject
      FROM payment_email_links pel
      JOIN bills b ON pel.payment_id = b.id AND pel.payment_type = 'bill'
      JOIN vendor_communications vc ON pel.email_id = vc.id
      LEFT JOIN properties p ON b.property_id = p.id
      LEFT JOIN vendors v ON b.vendor_id = v.id
      WHERE pel.link_type = 'confirmation'
        AND vc.received_at >= CURRENT_DATE - 3
        AND b.payment_method = 'auto_pay'
        ${hasVisibilityRestrictions ? "AND (b.property_id IS NULL OR b.property_id = ANY($1::uuid[]))" : ""}
    `, hasVisibilityRestrictions ? [visiblePropertyIds] : [])

    for (const confirmation of autoPayConfirmations) {
      const location = confirmation.property_name || confirmation.vendor_name || ""
      alertConfigs.push({
        alertType: "autopay_confirmed",
        title: `Auto-Pay Confirmed${location ? ` - ${location}` : ""}`,
        message: `${confirmation.description} (${formatCurrency(confirmation.amount)}) was automatically paid`,
        severity: "info",
        relatedTable: "bills",
        relatedId: confirmation.id,
        entityKey: `autopay_confirmed:${confirmation.id}`,
        sourceAmount: confirmation.amount,
        actionUrl: "/payments?status=confirmed",
        actionLabel: "View",
      })
    }

    // Insert all alerts (upsert to handle deduplication)
    for (const config of alertConfigs) {
      try {
        await query(`
          INSERT INTO alerts (
            alert_type, title, message, severity,
            related_table, related_id, entity_key,
            source_amount, action_url, action_label,
            expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (entity_key) WHERE resolved_at IS NULL AND is_dismissed = FALSE
          DO UPDATE SET
            title = EXCLUDED.title,
            message = EXCLUDED.message,
            severity = EXCLUDED.severity,
            source_amount = EXCLUDED.source_amount,
            action_url = EXCLUDED.action_url,
            action_label = EXCLUDED.action_label
        `, [
          config.alertType,
          config.title,
          config.message,
          config.severity,
          config.relatedTable,
          config.relatedId,
          config.entityKey,
          config.sourceAmount || null,
          config.actionUrl || null,
          config.actionLabel || null,
          null, // expires_at set on resolution
        ])
        results.created++
      } catch (error) {
        results.errors.push(`Failed to create alert ${config.entityKey}: ${error}`)
      }
    }

    // Auto-resolve alerts where condition no longer applies
    results.resolved = await autoResolveAlerts()

  } catch (error) {
    results.errors.push(`Alert generation failed: ${error}`)
  }

  return results
}

/**
 * Auto-resolve alerts where the underlying condition no longer applies
 */
async function autoResolveAlerts(): Promise<number> {
  let totalResolved = 0

  // Resolve bill alerts for bills that are no longer pending
  const resolvedBills = await query(`
    UPDATE alerts a
    SET resolved_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
    FROM bills b
    WHERE a.related_table = 'bills'
      AND a.related_id = b.id
      AND a.alert_type IN ('bill_due_soon', 'bill_overdue', 'check_unconfirmed')
      AND a.resolved_at IS NULL
      AND (b.status = 'confirmed' OR b.status = 'cancelled')
    RETURNING a.id
  `)
  totalResolved += resolvedBills.length

  // Resolve check_unconfirmed alerts for checks that have been confirmed
  const resolvedChecks = await query(`
    UPDATE alerts a
    SET resolved_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
    FROM bills b
    WHERE a.related_table = 'bills'
      AND a.related_id = b.id
      AND a.alert_type = 'check_unconfirmed'
      AND a.resolved_at IS NULL
      AND b.confirmation_date IS NOT NULL
    RETURNING a.id
  `)
  totalResolved += resolvedChecks.length

  // Resolve property tax alerts for taxes that are no longer pending
  const resolvedTaxes = await query(`
    UPDATE alerts a
    SET resolved_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
    FROM property_taxes pt
    WHERE a.related_table = 'property_taxes'
      AND a.related_id = pt.id
      AND a.alert_type IN ('tax_due_soon', 'tax_overdue')
      AND a.resolved_at IS NULL
      AND (pt.status = 'confirmed' OR pt.status = 'cancelled')
    RETURNING a.id
  `)
  totalResolved += resolvedTaxes.length

  // Resolve vehicle alerts for vehicles that are no longer active or have been renewed
  const resolvedRegistrations = await query(`
    UPDATE alerts a
    SET resolved_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
    FROM vehicles v
    WHERE a.related_table = 'vehicles'
      AND a.related_id = v.id
      AND a.alert_type IN ('registration_expired', 'registration_expiring')
      AND a.resolved_at IS NULL
      AND (v.is_active = FALSE OR v.registration_expires > CURRENT_DATE + 30)
    RETURNING a.id
  `)
  totalResolved += resolvedRegistrations.length

  const resolvedInspections = await query(`
    UPDATE alerts a
    SET resolved_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
    FROM vehicles v
    WHERE a.related_table = 'vehicles'
      AND a.related_id = v.id
      AND a.alert_type = 'inspection_overdue'
      AND a.resolved_at IS NULL
      AND (v.is_active = FALSE OR v.inspection_expires >= CURRENT_DATE)
    RETURNING a.id
  `)
  totalResolved += resolvedInspections.length

  return totalResolved
}

/**
 * Manually resolve alerts for a specific entity
 * Call this when a user takes action (pays bill, confirms check, etc.)
 */
export async function resolveAlertsForEntity(
  relatedTable: string,
  relatedId: string,
  alertTypes?: string[]
): Promise<number> {
  const result = await query(`
    UPDATE alerts
    SET resolved_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
    WHERE related_table = $1
      AND related_id = $2
      ${alertTypes ? "AND alert_type = ANY($3)" : ""}
      AND resolved_at IS NULL
    RETURNING id
  `, alertTypes ? [relatedTable, relatedId, alertTypes] : [relatedTable, relatedId])

  return result.length
}

/**
 * Clean up expired and old alerts
 */
export async function cleanupAlerts(): Promise<{ dismissed: number; deleted: number }> {
  // Mark expired alerts as dismissed
  const dismissed = await query(`
    UPDATE alerts
    SET is_dismissed = TRUE
    WHERE expires_at < NOW()
      AND is_dismissed = FALSE
    RETURNING id
  `)

  // Hard delete very old dismissed alerts
  const deleted = await query(`
    DELETE FROM alerts
    WHERE is_dismissed = TRUE
      AND created_at < NOW() - INTERVAL '90 days'
    RETURNING id
  `)

  return {
    dismissed: dismissed.length,
    deleted: deleted.length,
  }
}
