/**
 * Unified payment query functions
 *
 * Extracted from monolithic actions-remaining.ts as part of Phase 3B refactoring.
 * Combines bills, property taxes, and insurance premiums into unified payment views.
 */

"use server"

import { query, queryOne } from "../db"
import type { UnifiedPayment, PaymentSuggestion } from "@/types/database"

export interface UnifiedPaymentFilters {
  category?: string
  status?: string
  propertyId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

function getSortColumn(sortBy?: string): string {
  const validColumns: Record<string, string> = {
    description: 'description',
    property_name: 'property_name',
    due_date: 'due_date',
    amount: 'amount',
    status: 'status',
    category: 'category',
  }
  return validColumns[sortBy || 'due_date'] || 'due_date'
}

export async function getAllPayments(filters?: UnifiedPaymentFilters): Promise<UnifiedPayment[]> {
  // Build WHERE conditions based on filters
  const conditions: string[] = []
  const params: (string | number)[] = []
  let paramIndex = 1

  if (filters?.category && filters.category !== 'all') {
    conditions.push(`category = $${paramIndex}`)
    params.push(filters.category)
    paramIndex++
  }
  if (filters?.status && filters.status !== 'all') {
    conditions.push(`status = $${paramIndex}`)
    params.push(filters.status)
    paramIndex++
  }
  if (filters?.propertyId && filters.propertyId !== 'all') {
    conditions.push(`property_id = $${paramIndex}`)
    params.push(filters.propertyId)
    paramIndex++
  }
  if (filters?.dateFrom) {
    conditions.push(`due_date >= $${paramIndex}`)
    params.push(filters.dateFrom)
    paramIndex++
  }
  if (filters?.dateTo) {
    conditions.push(`due_date <= $${paramIndex}`)
    params.push(filters.dateTo)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const searchClause = filters?.search
    ? `WHERE description ILIKE $${paramIndex}`
    : ''
  if (filters?.search) {
    params.push(`%${filters.search}%`)
  }

  const sql = `
    WITH unified AS (
      -- Bills (excluding property_tax since those are in property_taxes table)
      SELECT
        b.id,
        'bill'::text as source,
        b.id as source_id,
        b.bill_type as category,
        COALESCE(b.description, b.bill_type::text) as description,
        b.property_id,
        p.name as property_name,
        b.vehicle_id,
        CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
        b.vendor_id,
        vn.name as vendor_name,
        b.amount,
        b.due_date::text,
        b.status,
        b.payment_method,
        b.payment_date::text,
        b.confirmation_date::text,
        CASE
          WHEN b.status = 'sent' AND b.payment_date IS NOT NULL AND b.confirmation_date IS NULL
          THEN CURRENT_DATE - b.payment_date
          ELSE NULL
        END as days_waiting,
        CASE
          WHEN b.status = 'pending' AND b.due_date < CURRENT_DATE THEN true
          ELSE false
        END as is_overdue,
        b.recurrence
      FROM bills b
      LEFT JOIN properties p ON b.property_id = p.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN vendors vn ON b.vendor_id = vn.id

      UNION ALL

      -- Property Taxes
      SELECT
        pt.id,
        'property_tax'::text as source,
        pt.id as source_id,
        'property_tax'::bill_type as category,
        pt.jurisdiction || ' ' || pt.tax_year || ' Q' || pt.installment as description,
        pt.property_id,
        p.name as property_name,
        NULL as vehicle_id,
        NULL as vehicle_name,
        NULL as vendor_id,
        NULL as vendor_name,
        pt.amount,
        pt.due_date::text,
        pt.status,
        NULL as payment_method,
        pt.payment_date::text,
        pt.confirmation_date::text,
        CASE
          WHEN pt.status = 'sent' AND pt.payment_date IS NOT NULL AND pt.confirmation_date IS NULL
          THEN CURRENT_DATE - pt.payment_date
          ELSE NULL
        END as days_waiting,
        CASE
          WHEN pt.status = 'pending' AND pt.due_date < CURRENT_DATE THEN true
          ELSE false
        END as is_overdue,
        'one_time'::recurrence as recurrence
      FROM property_taxes pt
      JOIN properties p ON pt.property_id = p.id

      UNION ALL

      -- Insurance Premiums (upcoming renewals)
      SELECT
        ip.id,
        'insurance_premium'::text as source,
        ip.id as source_id,
        'insurance'::bill_type as category,
        ip.carrier_name || ' - ' || ip.policy_type as description,
        ip.property_id,
        p.name as property_name,
        ip.vehicle_id,
        CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
        NULL as vendor_id,
        NULL as vendor_name,
        COALESCE(ip.premium_amount, 0) as amount,
        (ip.expiration_date - INTERVAL '30 days')::date::text as due_date,
        CASE
          WHEN ip.expiration_date < CURRENT_DATE THEN 'overdue'::payment_status
          WHEN ip.expiration_date < CURRENT_DATE + 30 THEN 'pending'::payment_status
          ELSE 'pending'::payment_status
        END as status,
        ip.payment_method,
        NULL as payment_date,
        NULL as confirmation_date,
        NULL as days_waiting,
        ip.expiration_date < CURRENT_DATE as is_overdue,
        ip.premium_frequency as recurrence
      FROM insurance_policies ip
      LEFT JOIN properties p ON ip.property_id = p.id
      LEFT JOIN vehicles v ON ip.vehicle_id = v.id
      WHERE ip.expiration_date >= CURRENT_DATE - 30  -- Only show if expiring soon or expired recently
    )
    SELECT * FROM unified
    ${whereClause}
    ${searchClause ? (whereClause ? ' AND ' + searchClause.replace('WHERE ', '') : searchClause) : ''}
    ORDER BY ${getSortColumn(filters?.sortBy)} ${filters?.sortOrder === 'asc' ? 'ASC' : 'DESC'}
  `

  return query<UnifiedPayment>(sql, params)
}

// Get payments needing attention (overdue, unconfirmed checks)
export async function getPaymentsNeedingAttention(): Promise<UnifiedPayment[]> {
  return query<UnifiedPayment>(`
    SELECT * FROM (
      -- Overdue bills
      SELECT
        b.id,
        'bill'::text as source,
        b.id as source_id,
        b.bill_type as category,
        COALESCE(b.description, b.bill_type::text) as description,
        b.property_id,
        p.name as property_name,
        b.vehicle_id,
        CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
        b.vendor_id,
        vn.name as vendor_name,
        b.amount,
        b.due_date::text,
        b.status,
        b.payment_method,
        b.payment_date::text,
        b.confirmation_date::text,
        CASE
          WHEN b.status = 'sent' AND b.payment_date IS NOT NULL AND b.confirmation_date IS NULL
          THEN CURRENT_DATE - b.payment_date
          ELSE NULL
        END as days_waiting,
        CASE
          WHEN b.status = 'pending' AND b.due_date < CURRENT_DATE THEN true
          ELSE false
        END as is_overdue,
        b.recurrence
      FROM bills b
      LEFT JOIN properties p ON b.property_id = p.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN vendors vn ON b.vendor_id = vn.id
      WHERE (b.status = 'pending' AND b.due_date < CURRENT_DATE)
         OR (b.status = 'sent' AND b.payment_date IS NOT NULL AND b.confirmation_date IS NULL
             AND b.payment_date + b.days_to_confirm < CURRENT_DATE)

      UNION ALL

      -- Overdue property taxes
      SELECT
        pt.id,
        'property_tax'::text as source,
        pt.id as source_id,
        'property_tax'::bill_type as category,
        pt.jurisdiction || ' ' || pt.tax_year || ' Q' || pt.installment as description,
        pt.property_id,
        p.name as property_name,
        NULL as vehicle_id,
        NULL as vehicle_name,
        NULL as vendor_id,
        NULL as vendor_name,
        pt.amount,
        pt.due_date::text,
        pt.status,
        NULL as payment_method,
        pt.payment_date::text,
        pt.confirmation_date::text,
        CASE
          WHEN pt.status = 'sent' AND pt.payment_date IS NOT NULL AND pt.confirmation_date IS NULL
          THEN CURRENT_DATE - pt.payment_date
          ELSE NULL
        END as days_waiting,
        CASE
          WHEN pt.status = 'pending' AND pt.due_date < CURRENT_DATE THEN true
          ELSE false
        END as is_overdue,
        'one_time'::recurrence as recurrence
      FROM property_taxes pt
      JOIN properties p ON pt.property_id = p.id
      WHERE pt.status = 'pending' AND pt.due_date < CURRENT_DATE
    ) combined
    ORDER BY
      CASE WHEN days_waiting IS NOT NULL THEN 0 ELSE 1 END,
      days_waiting DESC NULLS LAST,
      due_date ASC
  `)
}

export async function getPaymentsAwaitingConfirmation(): Promise<UnifiedPayment[]> {
  return query<UnifiedPayment>(`
    SELECT
      b.id,
      'bill'::text as source,
      b.id as source_id,
      b.bill_type as category,
      COALESCE(b.description, b.bill_type::text) as description,
      b.property_id,
      p.name as property_name,
      b.vehicle_id,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
      b.vendor_id,
      vn.name as vendor_name,
      b.amount,
      b.due_date::text,
      b.status,
      b.payment_method,
      b.payment_date::text,
      b.confirmation_date::text,
      CURRENT_DATE - b.payment_date as days_waiting,
      false as is_overdue,
      b.recurrence
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN vendors vn ON b.vendor_id = vn.id
    WHERE b.status = 'sent'
      AND b.payment_date IS NOT NULL
      AND b.confirmation_date IS NULL
    ORDER BY b.payment_date ASC
  `)
}

/**
 * Get pending payment suggestions (high/medium confidence only).
 * Excludes invoice emails that already have a matching auto-pay bill.
 */
export async function getPendingPaymentSuggestions(): Promise<PaymentSuggestion[]> {
  return query<PaymentSuggestion>(`
    SELECT
      ps.*,
      v.name as vendor_name,
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
 * Get count of pending payment suggestions.
 * Excludes invoice emails that already have a matching auto-pay bill.
 */
export async function getPaymentSuggestionCount(): Promise<number> {
  const result = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count
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
  `)
  return result ? parseInt(result.count, 10) : 0
}
