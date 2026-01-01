"use server"

import { query, queryOne } from "./db"
import type {
  Property,
  Vehicle,
  Vendor,
  Bill,
  PropertyTax,
  InsurancePolicy,
  MaintenanceTask,
  PropertyVendor,
  SharedTaskList,
  SharedTaskItem,
  UnifiedPayment,
} from "@/types/database"

// Properties
export async function getProperties(): Promise<Property[]> {
  return query<Property>("SELECT * FROM properties ORDER BY name")
}

export async function getProperty(id: string): Promise<Property | null> {
  return queryOne<Property>("SELECT * FROM properties WHERE id = $1", [id])
}

export async function getActiveProperties(): Promise<Property[]> {
  return query<Property>("SELECT * FROM properties WHERE status = 'active' ORDER BY name")
}

// Vehicles
export async function getVehicles(): Promise<Vehicle[]> {
  return query<Vehicle>("SELECT * FROM vehicles ORDER BY year DESC, make, model")
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  return queryOne<Vehicle>("SELECT * FROM vehicles WHERE id = $1", [id])
}

export async function getActiveVehicles(): Promise<Vehicle[]> {
  return query<Vehicle>("SELECT * FROM vehicles WHERE is_active = TRUE ORDER BY year DESC, make, model")
}

// Vendors
export async function getVendors(): Promise<Vendor[]> {
  return query<Vendor>("SELECT * FROM vendors ORDER BY name")
}

export async function getVendor(id: string): Promise<Vendor | null> {
  return queryOne<Vendor>("SELECT * FROM vendors WHERE id = $1", [id])
}

export async function getActiveVendors(): Promise<Vendor[]> {
  return query<Vendor>("SELECT * FROM vendors WHERE is_active = TRUE ORDER BY name")
}

export async function getVendorsBySpecialty(specialty: string): Promise<Vendor[]> {
  return query<Vendor>(
    "SELECT * FROM vendors WHERE specialty = $1 AND is_active = TRUE ORDER BY rating DESC NULLS LAST, name",
    [specialty]
  )
}

// Vendor with associated properties for location display
export interface VendorWithLocations extends Vendor {
  locations: string[]
}

interface VendorFilters {
  specialty?: string
  location?: string
  search?: string
}

// Get vendors with filters and location info
export async function getVendorsFiltered(filters?: VendorFilters): Promise<VendorWithLocations[]> {
  // Base query gets vendors with their associated property locations
  const vendors = await query<Vendor & { property_locations: string | null }>(`
    SELECT
      v.*,
      STRING_AGG(DISTINCT
        CASE
          WHEN p.state IS NOT NULL THEN p.state
          WHEN p.country != 'USA' THEN p.country
          ELSE NULL
        END, ', '
      ) as property_locations
    FROM vendors v
    LEFT JOIN property_vendors pv ON v.id = pv.vendor_id
    LEFT JOIN properties p ON pv.property_id = p.id
    GROUP BY v.id
    ORDER BY v.name
  `)

  // Transform and filter in memory
  let result: VendorWithLocations[] = vendors.map(v => ({
    ...v,
    locations: v.property_locations ? v.property_locations.split(', ').filter(Boolean) : []
  }))

  if (filters?.specialty && filters.specialty !== 'all') {
    result = result.filter(v => v.specialty === filters.specialty)
  }

  if (filters?.location && filters.location !== 'all') {
    const location = filters.location
    result = result.filter(v => v.locations.includes(location))
  }

  if (filters?.search) {
    const searchLower = filters.search.toLowerCase()
    result = result.filter(v =>
      v.name.toLowerCase().includes(searchLower) ||
      v.company?.toLowerCase().includes(searchLower) ||
      v.notes?.toLowerCase().includes(searchLower)
    )
  }

  return result
}

// Get unique locations from vendor-property associations
export async function getVendorLocations(): Promise<string[]> {
  const results = await query<{ location: string }>(`
    SELECT DISTINCT
      CASE
        WHEN p.state IS NOT NULL THEN p.state
        WHEN p.country != 'USA' THEN p.country
        ELSE NULL
      END as location
    FROM property_vendors pv
    JOIN properties p ON pv.property_id = p.id
    WHERE
      CASE
        WHEN p.state IS NOT NULL THEN p.state
        WHEN p.country != 'USA' THEN p.country
        ELSE NULL
      END IS NOT NULL
    ORDER BY location
  `)
  return results.map(r => r.location)
}

// Get properties assigned to a vendor
export async function getPropertiesForVendor(vendorId: string): Promise<Property[]> {
  return query<Property>(`
    SELECT p.*
    FROM properties p
    JOIN property_vendors pv ON p.id = pv.property_id
    WHERE pv.vendor_id = $1
    ORDER BY p.name
  `, [vendorId])
}

// Vendor Communications (Email Journal)
export interface VendorCommunication {
  id: string
  vendor_id: string | null
  gmail_message_id: string
  thread_id: string | null
  direction: "inbound" | "outbound"
  from_email: string
  to_email: string
  subject: string | null
  body_snippet: string | null
  body_html: string | null
  received_at: string
  is_read: boolean
  is_important: boolean
  has_attachment: boolean
  attachment_names: string[]
  labels: string[]
  created_at: string
  vendor?: Vendor
}

export async function getVendorCommunications(vendorId: string): Promise<VendorCommunication[]> {
  return query<VendorCommunication>(
    `SELECT * FROM vendor_communications
     WHERE vendor_id = $1
     ORDER BY received_at DESC`,
    [vendorId]
  )
}

export async function getRecentCommunications(limit: number = 50): Promise<VendorCommunication[]> {
  return query<VendorCommunication>(
    `SELECT vc.*, row_to_json(v.*) as vendor
     FROM vendor_communications vc
     LEFT JOIN vendors v ON vc.vendor_id = v.id
     ORDER BY vc.received_at DESC
     LIMIT $1`,
    [limit]
  )
}

export async function getUnmatchedCommunications(): Promise<VendorCommunication[]> {
  return query<VendorCommunication>(
    `SELECT * FROM vendor_communications
     WHERE vendor_id IS NULL
     ORDER BY received_at DESC
     LIMIT 100`
  )
}

export async function getCommunicationStats(): Promise<{
  total: number
  matched: number
  unmatched: number
  urgent: number
}> {
  const stats = await queryOne<{
    total: string
    matched: string
    unmatched: string
    urgent: string
  }>(`
    SELECT
      COUNT(*) as total,
      COUNT(vendor_id) as matched,
      COUNT(*) - COUNT(vendor_id) as unmatched,
      COUNT(*) FILTER (WHERE is_important = TRUE) as urgent
    FROM vendor_communications
  `)

  return {
    total: parseInt(stats?.total || "0"),
    matched: parseInt(stats?.matched || "0"),
    unmatched: parseInt(stats?.unmatched || "0"),
    urgent: parseInt(stats?.urgent || "0"),
  }
}

// Property Vendors (lookup)
export async function getPropertyVendors(propertyId: string): Promise<(PropertyVendor & { vendor: Vendor })[]> {
  return query<PropertyVendor & { vendor: Vendor }>(
    `SELECT pv.*, row_to_json(v.*) as vendor
     FROM property_vendors pv
     JOIN vendors v ON pv.vendor_id = v.id
     WHERE pv.property_id = $1
     ORDER BY pv.is_primary DESC, v.name`,
    [propertyId]
  )
}

export async function findVendorForProperty(
  propertyId: string,
  specialty: string
): Promise<Vendor | null> {
  return queryOne<Vendor>(
    `SELECT v.*
     FROM property_vendors pv
     JOIN vendors v ON pv.vendor_id = v.id
     WHERE pv.property_id = $1
       AND (pv.specialty_override = $2 OR v.specialty = $2)
       AND v.is_active = TRUE
     ORDER BY pv.is_primary DESC
     LIMIT 1`,
    [propertyId, specialty]
  )
}

// Bills
export async function getBills(): Promise<Bill[]> {
  return query<Bill>(
    `SELECT b.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM bills b
     LEFT JOIN properties p ON b.property_id = p.id
     LEFT JOIN vehicles v ON b.vehicle_id = v.id
     ORDER BY b.due_date`
  )
}

export async function getUpcomingBills(days: number = 30): Promise<Bill[]> {
  return query<Bill>(
    `SELECT b.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM bills b
     LEFT JOIN properties p ON b.property_id = p.id
     LEFT JOIN vehicles v ON b.vehicle_id = v.id
     WHERE b.status IN ('pending', 'sent')
       AND b.due_date <= CURRENT_DATE + ($1::INTEGER)
     ORDER BY b.due_date`,
    [days]
  )
}

export async function getBillsNeedingConfirmation(): Promise<Bill[]> {
  return query<Bill>(
    `SELECT b.*, row_to_json(p.*) as property
     FROM bills b
     LEFT JOIN properties p ON b.property_id = p.id
     WHERE b.status = 'sent'
       AND b.payment_date IS NOT NULL
       AND b.confirmation_date IS NULL
       AND b.payment_date + b.days_to_confirm < CURRENT_DATE
     ORDER BY b.payment_date`
  )
}

// Property Taxes
export async function getPropertyTaxes(): Promise<PropertyTax[]> {
  return query<PropertyTax>(
    `SELECT pt.*, row_to_json(p.*) as property
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     ORDER BY pt.due_date`
  )
}

export async function getUpcomingPropertyTaxes(days: number = 90): Promise<PropertyTax[]> {
  return query<PropertyTax>(
    `SELECT pt.*, row_to_json(p.*) as property
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.status = 'pending'
       AND pt.due_date <= CURRENT_DATE + ($1::INTEGER)
     ORDER BY pt.due_date`,
    [days]
  )
}

export async function getPropertyTaxHistory(propertyId: string): Promise<PropertyTax[]> {
  return query<PropertyTax>(
    `SELECT * FROM property_taxes
     WHERE property_id = $1
     ORDER BY tax_year DESC, installment`,
    [propertyId]
  )
}

// Insurance
export async function getInsurancePolicies(): Promise<InsurancePolicy[]> {
  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     ORDER BY ip.expiration_date`
  )
}

export async function getExpiringPolicies(days: number = 60): Promise<InsurancePolicy[]> {
  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.expiration_date <= CURRENT_DATE + ($1::INTEGER)
     ORDER BY ip.expiration_date`,
    [days]
  )
}

// Unified Payments - combines bills, property taxes, and insurance premiums
export interface UnifiedPaymentFilters {
  category?: string
  status?: string
  propertyId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
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
    ORDER BY due_date DESC
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

// Maintenance Tasks
export async function getMaintenanceTasks(): Promise<MaintenanceTask[]> {
  return query<MaintenanceTask>(
    `SELECT mt.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     ORDER BY
       CASE mt.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       mt.due_date NULLS LAST`
  )
}

export async function getPendingMaintenanceTasks(): Promise<MaintenanceTask[]> {
  return query<MaintenanceTask>(
    `SELECT mt.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     WHERE mt.status IN ('pending', 'in_progress')
     ORDER BY
       CASE mt.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       mt.due_date NULLS LAST`
  )
}

export async function getUrgentTasks(): Promise<MaintenanceTask[]> {
  return query<MaintenanceTask>(
    `SELECT mt.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     WHERE mt.status IN ('pending', 'in_progress')
       AND mt.priority IN ('urgent', 'high')
     ORDER BY
       CASE mt.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
       END,
       mt.due_date NULLS LAST`
  )
}

// Shared Task Lists
export async function getSharedTaskLists(): Promise<SharedTaskList[]> {
  return query<SharedTaskList>(
    `SELECT stl.*, row_to_json(p.*) as property
     FROM shared_task_lists stl
     JOIN properties p ON stl.property_id = p.id
     WHERE stl.is_active = TRUE
     ORDER BY p.name, stl.title`
  )
}

export async function getSharedTaskListWithItems(listId: string): Promise<SharedTaskList | null> {
  const list = await queryOne<SharedTaskList>(
    `SELECT stl.*, row_to_json(p.*) as property
     FROM shared_task_lists stl
     JOIN properties p ON stl.property_id = p.id
     WHERE stl.id = $1`,
    [listId]
  )

  if (list) {
    const items = await query<SharedTaskItem>(
      `SELECT * FROM shared_task_items WHERE list_id = $1 ORDER BY sort_order, created_at`,
      [listId]
    )
    list.items = items
  }

  return list
}

export async function getSharedTaskListsForProperty(propertyId: string): Promise<SharedTaskList[]> {
  return query<SharedTaskList>(
    `SELECT * FROM shared_task_lists WHERE property_id = $1 AND is_active = TRUE ORDER BY title`,
    [propertyId]
  )
}

// Global Search
export interface SearchResult {
  type: "property" | "vehicle" | "vendor" | "bill" | "task"
  id: string
  title: string
  subtitle: string
  href: string
}

export async function globalSearch(searchTerm: string): Promise<SearchResult[]> {
  if (!searchTerm || searchTerm.length < 2) return []

  const term = `%${searchTerm.toLowerCase()}%`

  const [properties, vehicles, vendors, tasks] = await Promise.all([
    query<{ id: string; name: string; city: string; state: string }>(
      `SELECT id, name, city, state FROM properties
       WHERE LOWER(name) LIKE $1 OR LOWER(address) LIKE $1 OR LOWER(city) LIKE $1
       LIMIT 5`,
      [term]
    ),
    query<{ id: string; year: number; make: string; model: string; license_plate: string }>(
      `SELECT id, year, make, model, license_plate FROM vehicles
       WHERE LOWER(make) LIKE $1 OR LOWER(model) LIKE $1 OR license_plate ILIKE $1
       LIMIT 5`,
      [term]
    ),
    query<{ id: string; name: string; company: string; specialty: string }>(
      `SELECT id, name, company, specialty FROM vendors
       WHERE LOWER(name) LIKE $1 OR LOWER(company) LIKE $1 OR specialty::text ILIKE $1
       LIMIT 5`,
      [term]
    ),
    query<{ id: string; title: string; priority: string }>(
      `SELECT id, title, priority FROM maintenance_tasks
       WHERE LOWER(title) LIKE $1 OR LOWER(description) LIKE $1
       LIMIT 5`,
      [term]
    ),
  ])

  const results: SearchResult[] = []

  properties.forEach((p) => {
    results.push({
      type: "property",
      id: p.id,
      title: p.name,
      subtitle: `${p.city}, ${p.state || ""}`.trim(),
      href: `/properties/${p.id}`,
    })
  })

  vehicles.forEach((v) => {
    results.push({
      type: "vehicle",
      id: v.id,
      title: `${v.year} ${v.make} ${v.model}`,
      subtitle: v.license_plate || "",
      href: `/vehicles/${v.id}`,
    })
  })

  vendors.forEach((v) => {
    results.push({
      type: "vendor",
      id: v.id,
      title: v.name,
      subtitle: v.company || v.specialty,
      href: `/vendors/${v.id}`,
    })
  })

  tasks.forEach((t) => {
    results.push({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: t.priority,
      href: `/maintenance`,
    })
  })

  return results
}

// Dashboard Stats
export async function getDashboardStats() {
  const [
    propertyCount,
    vehicleCount,
    upcomingBillsCount,
    urgentTasksCount,
  ] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM properties WHERE status = 'active'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM vehicles WHERE is_active = TRUE"),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM bills WHERE status = 'pending' AND due_date <= CURRENT_DATE + 30"
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM maintenance_tasks WHERE status IN ('pending', 'in_progress') AND priority IN ('urgent', 'high')"
    ),
  ])

  return {
    properties: parseInt(propertyCount?.count || "0"),
    vehicles: parseInt(vehicleCount?.count || "0"),
    upcomingBills: parseInt(upcomingBillsCount?.count || "0"),
    urgentTasks: parseInt(urgentTasksCount?.count || "0"),
  }
}

// ============================================
// REPORT QUERIES
// ============================================

// Payment Summary Report
export interface PaymentSummaryReport {
  bills: Bill[]
  byType: Record<string, number>
  byProperty: Record<string, number>
  total: number
  count: number
  year: number
}

export async function getPaymentSummaryReport(year?: number): Promise<PaymentSummaryReport> {
  const targetYear = year || new Date().getFullYear()

  const bills = await query<Bill>(
    `SELECT b.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM bills b
     LEFT JOIN properties p ON b.property_id = p.id
     LEFT JOIN vehicles v ON b.vehicle_id = v.id
     WHERE EXTRACT(YEAR FROM b.due_date) = $1
     ORDER BY b.due_date`,
    [targetYear]
  )

  const byType: Record<string, number> = {}
  const byProperty: Record<string, number> = {}
  let total = 0

  bills.forEach((bill) => {
    const amount = Number(bill.amount) || 0
    total += amount

    // Group by bill type
    const type = bill.bill_type || "other"
    byType[type] = (byType[type] || 0) + amount

    // Group by property
    const propertyName = (bill as Bill & { property?: Property }).property?.name || "No Property"
    byProperty[propertyName] = (byProperty[propertyName] || 0) + amount
  })

  return { bills, byType, byProperty, total, count: bills.length, year: targetYear }
}

// Property Values Report
export interface PropertyValueReport {
  id: string
  name: string
  city: string
  state: string | null
  property_type: string
  purchase_date: string | null
  purchase_price: number | null
  current_value: number | null
  appreciation: number | null
  appreciationPercent: number | null
}

export interface PropertyValuesReport {
  properties: PropertyValueReport[]
  totalPurchaseValue: number
  totalCurrentValue: number
  totalAppreciation: number
  averageAppreciationPercent: number
}

export async function getPropertyValuesReport(): Promise<PropertyValuesReport> {
  const rawProperties = await query<Property>(
    `SELECT * FROM properties WHERE status = 'active' ORDER BY name`
  )

  let totalPurchaseValue = 0
  let totalCurrentValue = 0
  let propertiesWithAppreciation = 0
  let totalAppreciationPercent = 0

  const properties: PropertyValueReport[] = rawProperties.map((p) => {
    const purchasePrice = Number(p.purchase_price) || null
    const currentValue = Number(p.current_value) || null

    let appreciation: number | null = null
    let appreciationPercent: number | null = null

    if (purchasePrice && currentValue) {
      appreciation = currentValue - purchasePrice
      appreciationPercent = ((currentValue - purchasePrice) / purchasePrice) * 100
      totalPurchaseValue += purchasePrice
      totalCurrentValue += currentValue
      propertiesWithAppreciation++
      totalAppreciationPercent += appreciationPercent
    } else if (currentValue) {
      totalCurrentValue += currentValue
    }

    return {
      id: p.id,
      name: p.name,
      city: p.city,
      state: p.state,
      property_type: p.property_type,
      purchase_date: p.purchase_date,
      purchase_price: purchasePrice,
      current_value: currentValue,
      appreciation,
      appreciationPercent,
    }
  })

  return {
    properties,
    totalPurchaseValue,
    totalCurrentValue,
    totalAppreciation: totalCurrentValue - totalPurchaseValue,
    averageAppreciationPercent: propertiesWithAppreciation > 0
      ? totalAppreciationPercent / propertiesWithAppreciation
      : 0,
  }
}

// Tax Calendar Report
export interface TaxCalendarReport {
  taxes: PropertyTax[]
  byJurisdiction: Record<string, number>
  byMonth: Record<string, number>
  totalDue: number
  totalPaid: number
  totalPending: number
  year: number
}

export async function getTaxCalendarReport(year?: number): Promise<TaxCalendarReport> {
  const targetYear = year || new Date().getFullYear()

  const taxes = await query<PropertyTax>(
    `SELECT pt.*, row_to_json(p.*) as property
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.tax_year = $1
     ORDER BY pt.due_date, p.name`,
    [targetYear]
  )

  const byJurisdiction: Record<string, number> = {}
  const byMonth: Record<string, number> = {}
  let totalDue = 0
  let totalPaid = 0
  let totalPending = 0

  taxes.forEach((tax) => {
    const amount = Number(tax.amount) || 0
    totalDue += amount

    if (tax.status === "confirmed") {
      totalPaid += amount
    } else {
      totalPending += amount
    }

    // Group by jurisdiction
    byJurisdiction[tax.jurisdiction] = (byJurisdiction[tax.jurisdiction] || 0) + amount

    // Group by month
    if (tax.due_date) {
      const month = new Date(tax.due_date).toLocaleDateString("en-US", { month: "short" })
      byMonth[month] = (byMonth[month] || 0) + amount
    }
  })

  return { taxes, byJurisdiction, byMonth, totalDue, totalPaid, totalPending, year: targetYear }
}

// Maintenance Costs Report
export interface MaintenanceCostsReport {
  tasks: MaintenanceTask[]
  byProperty: Record<string, number>
  byPriority: Record<string, number>
  totalEstimated: number
  totalActual: number
  completedCount: number
  pendingCount: number
  year: number
}

export async function getMaintenanceCostsReport(year?: number): Promise<MaintenanceCostsReport> {
  const targetYear = year || new Date().getFullYear()

  const tasks = await query<MaintenanceTask>(
    `SELECT mt.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     WHERE EXTRACT(YEAR FROM COALESCE(mt.completed_date, mt.due_date, mt.created_at)) = $1
     ORDER BY mt.completed_date DESC NULLS LAST, mt.due_date`,
    [targetYear]
  )

  const byProperty: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  let totalEstimated = 0
  let totalActual = 0
  let completedCount = 0
  let pendingCount = 0

  tasks.forEach((task) => {
    const estimated = Number(task.estimated_cost) || 0
    const actual = Number(task.actual_cost) || 0
    totalEstimated += estimated
    totalActual += actual

    if (task.status === "completed") {
      completedCount++
    } else if (task.status === "pending" || task.status === "in_progress") {
      pendingCount++
    }

    // Group by property (use actual cost if available, otherwise estimated)
    const cost = actual || estimated
    const propertyName = (task as MaintenanceTask & { property?: Property }).property?.name || "No Property"
    byProperty[propertyName] = (byProperty[propertyName] || 0) + cost

    // Group by priority
    byPriority[task.priority] = (byPriority[task.priority] || 0) + cost
  })

  return {
    tasks,
    byProperty,
    byPriority,
    totalEstimated,
    totalActual,
    completedCount,
    pendingCount,
    year: targetYear,
  }
}

// Insurance Coverage Report
export interface InsuranceCoverageReport {
  policies: InsurancePolicy[]
  byType: Record<string, { count: number; premium: number; coverage: number }>
  totalAnnualPremium: number
  totalCoverage: number
  policyCount: number
  expiringWithin60Days: number
}

export async function getInsuranceCoverageReport(): Promise<InsuranceCoverageReport> {
  const policies = await query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     ORDER BY ip.policy_type, ip.carrier_name`
  )

  const byType: Record<string, { count: number; premium: number; coverage: number }> = {}
  let totalAnnualPremium = 0
  let totalCoverage = 0
  let expiringWithin60Days = 0
  const now = new Date()
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  policies.forEach((policy) => {
    const premium = Number(policy.premium_amount) || 0
    const coverage = Number(policy.coverage_amount) || 0

    // Annualize premium
    let annualPremium = premium
    switch (policy.premium_frequency) {
      case "monthly":
        annualPremium = premium * 12
        break
      case "quarterly":
        annualPremium = premium * 4
        break
      case "semi_annual":
        annualPremium = premium * 2
        break
    }
    totalAnnualPremium += annualPremium
    totalCoverage += coverage

    // Check expiration
    if (policy.expiration_date) {
      const expDate = new Date(policy.expiration_date)
      if (expDate <= sixtyDaysFromNow) {
        expiringWithin60Days++
      }
    }

    // Group by type
    if (!byType[policy.policy_type]) {
      byType[policy.policy_type] = { count: 0, premium: 0, coverage: 0 }
    }
    byType[policy.policy_type].count++
    byType[policy.policy_type].premium += annualPremium
    byType[policy.policy_type].coverage += coverage
  })

  return {
    policies,
    byType,
    totalAnnualPremium,
    totalCoverage,
    policyCount: policies.length,
    expiringWithin60Days,
  }
}

// Year-End Export Report
export interface YearEndCategory {
  category: string
  items: { description: string; amount: number; date: string | null }[]
  total: number
}

export interface YearEndReport {
  year: number
  categories: YearEndCategory[]
  grandTotal: number
  propertyTaxTotal: number
  insuranceTotal: number
  maintenanceTotal: number
  otherBillsTotal: number
}

export async function getYearEndExportData(year?: number): Promise<YearEndReport> {
  const targetYear = year || new Date().getFullYear()

  const [bills, taxes, policies, maintenanceTasks] = await Promise.all([
    query<Bill>(
      `SELECT b.*, row_to_json(p.*) as property
       FROM bills b
       LEFT JOIN properties p ON b.property_id = p.id
       WHERE EXTRACT(YEAR FROM b.due_date) = $1
         AND b.status IN ('sent', 'confirmed')
       ORDER BY b.due_date`,
      [targetYear]
    ),
    query<PropertyTax>(
      `SELECT pt.*, row_to_json(p.*) as property
       FROM property_taxes pt
       JOIN properties p ON pt.property_id = p.id
       WHERE pt.tax_year = $1
       ORDER BY pt.due_date`,
      [targetYear]
    ),
    query<InsurancePolicy>(
      `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
       FROM insurance_policies ip
       LEFT JOIN properties p ON ip.property_id = p.id
       LEFT JOIN vehicles v ON ip.vehicle_id = v.id
       WHERE EXTRACT(YEAR FROM ip.effective_date) <= $1
         AND (ip.expiration_date IS NULL OR EXTRACT(YEAR FROM ip.expiration_date) >= $1)`,
      [targetYear]
    ),
    query<MaintenanceTask>(
      `SELECT mt.*, row_to_json(p.*) as property
       FROM maintenance_tasks mt
       LEFT JOIN properties p ON mt.property_id = p.id
       WHERE mt.status = 'completed'
         AND EXTRACT(YEAR FROM mt.completed_date) = $1
       ORDER BY mt.completed_date`,
      [targetYear]
    ),
  ])

  const categories: YearEndCategory[] = []
  let grandTotal = 0

  // Property Taxes
  const taxItems = taxes.map((t) => ({
    description: `${(t as PropertyTax & { property?: Property }).property?.name || "Unknown"} - ${t.jurisdiction} Q${t.installment}`,
    amount: Number(t.amount) || 0,
    date: t.due_date,
  }))
  const propertyTaxTotal = taxItems.reduce((sum, i) => sum + i.amount, 0)
  categories.push({ category: "Property Taxes", items: taxItems, total: propertyTaxTotal })
  grandTotal += propertyTaxTotal

  // Insurance Premiums (annualized)
  const insuranceItems = policies.map((p) => {
    let annualPremium = Number(p.premium_amount) || 0
    switch (p.premium_frequency) {
      case "monthly": annualPremium *= 12; break
      case "quarterly": annualPremium *= 4; break
      case "semi_annual": annualPremium *= 2; break
    }
    return {
      description: `${p.carrier_name} - ${p.policy_type}`,
      amount: annualPremium,
      date: p.effective_date,
    }
  })
  const insuranceTotal = insuranceItems.reduce((sum, i) => sum + i.amount, 0)
  categories.push({ category: "Insurance Premiums", items: insuranceItems, total: insuranceTotal })
  grandTotal += insuranceTotal

  // Maintenance
  const maintenanceItems = maintenanceTasks.map((t) => ({
    description: `${(t as MaintenanceTask & { property?: Property }).property?.name || "General"} - ${t.title}`,
    amount: Number(t.actual_cost) || Number(t.estimated_cost) || 0,
    date: t.completed_date,
  }))
  const maintenanceTotal = maintenanceItems.reduce((sum, i) => sum + i.amount, 0)
  categories.push({ category: "Maintenance", items: maintenanceItems, total: maintenanceTotal })
  grandTotal += maintenanceTotal

  // Other Bills (excluding property_tax which is handled separately)
  const otherBillItems = bills
    .filter((b) => b.bill_type !== "property_tax")
    .map((b) => ({
      description: `${(b as Bill & { property?: Property }).property?.name || "General"} - ${b.description || b.bill_type}`,
      amount: Number(b.amount) || 0,
      date: b.due_date,
    }))
  const otherBillsTotal = otherBillItems.reduce((sum, i) => sum + i.amount, 0)
  categories.push({ category: "Other Bills", items: otherBillItems, total: otherBillsTotal })
  grandTotal += otherBillsTotal

  return {
    year: targetYear,
    categories,
    grandTotal,
    propertyTaxTotal,
    insuranceTotal,
    maintenanceTotal,
    otherBillsTotal,
  }
}

// ============================================
// BuildingLink Communications
// ============================================

export type BuildingLinkCategory =
  | 'critical'
  | 'important'
  | 'maintenance'
  | 'security'
  | 'routine'
  | 'noise'

export interface BuildingLinkMessage {
  id: string
  subject: string
  body_snippet: string | null
  body_html: string | null
  received_at: string
  category: BuildingLinkCategory
  subcategory: string
  is_read: boolean
  unit: 'PH2E' | 'PH2F' | 'both' | 'unknown'
}

export interface BuildingLinkStats {
  total: number
  unread: number
  critical: number
  important: number
  maintenance: number
  security: number
  todayCount: number
  thisWeekCount: number
}

// Categorize a BuildingLink message based on subject and content
function categorizeBuildingLinkMessage(subject: string, body: string | null): { category: BuildingLinkCategory; subcategory: string } {
  const s = subject.toLowerCase()
  const b = (body || '').toLowerCase()

  // Critical - needs immediate attention
  if (s.includes('out of service') || s.includes('emergency') || s.includes('urgent') || s.includes('water shut')) {
    return { category: 'critical', subcategory: 'Service Outage' }
  }

  // Important - building notices, HOA, policy changes
  if (s.includes('meeting') || s.includes('vote') || s.includes('annual')) {
    return { category: 'important', subcategory: 'HOA/Meeting' }
  }
  if (s.includes('notice') || s.includes('reminder:') || s.includes('policy') || s.includes('schedule')) {
    return { category: 'important', subcategory: 'Building Notice' }
  }
  if (s.includes('back in service') || s.includes('resolved') || s.includes('reopened')) {
    return { category: 'important', subcategory: 'Service Restored' }
  }
  if (s.includes('cooling') || s.includes('heating') || s.includes('hvac') || s.includes('winteriz')) {
    return { category: 'important', subcategory: 'HVAC Notice' }
  }
  if (s.includes('monthly update') || s.includes('newsletter') || s.includes('news letter')) {
    return { category: 'important', subcategory: 'Newsletter' }
  }

  // Maintenance - request updates
  if (s.includes('maintenance request')) {
    return { category: 'maintenance', subcategory: 'Maintenance Request' }
  }

  // Security - key access logs
  if (s.includes('key ') || s.includes('keylink')) {
    return { category: 'security', subcategory: 'Key Access' }
  }

  // Routine - amenities, events, resident postings
  if (s.includes('pool') || s.includes('gym') || s.includes('amenity') || s.includes('amenities') || s.includes('fitness')) {
    return { category: 'routine', subcategory: 'Amenity Update' }
  }
  if (s.includes('party') || s.includes('event') || s.includes('holiday') || s.includes('salsa')) {
    return { category: 'routine', subcategory: 'Building Event' }
  }
  if (s.includes('resident posting') || s.includes('lost & found')) {
    return { category: 'routine', subcategory: 'Resident Posting' }
  }
  if (s.includes('window cleaning') || s.includes('fire pump') || s.includes('peloton')) {
    return { category: 'routine', subcategory: 'Building Update' }
  }

  // Noise - packages, deliveries, pickups
  if (s.includes('package') || s.includes('delivery') || s.includes('usps') || s.includes('ups') || s.includes('fedex')) {
    return { category: 'noise', subcategory: 'Package Delivery' }
  }
  if (s.includes('picked up')) {
    return { category: 'noise', subcategory: 'Package Pickup' }
  }
  if (s.includes('dry cleaning')) {
    return { category: 'noise', subcategory: 'Dry Cleaning' }
  }
  if (s === 'notification' && (b.includes('amazon') || b.includes('package') || b.includes('delivery'))) {
    return { category: 'noise', subcategory: 'Package Notification' }
  }
  if (s.includes('unclaimed') && s.includes('deliver')) {
    return { category: 'routine', subcategory: 'Unclaimed Package' }
  }

  // Default - categorize as routine
  return { category: 'routine', subcategory: 'Other' }
}

// Extract unit from message
function extractUnit(subject: string, body: string | null): 'PH2E' | 'PH2F' | 'both' | 'unknown' {
  const text = `${subject} ${body || ''}`.toUpperCase()
  const hasE = text.includes('PH2-E') || text.includes('NPH2-E') || text.includes('PH2E')
  const hasF = text.includes('PH2-F') || text.includes('NPH2-F') || text.includes('PH2F')

  if (hasE && hasF) return 'both'
  if (hasE) return 'PH2E'
  if (hasF) return 'PH2F'
  return 'unknown' // Building-wide messages
}

export async function getBuildingLinkVendorId(): Promise<string | null> {
  const vendor = await queryOne<{ id: string }>(
    "SELECT id FROM vendors WHERE LOWER(name) = 'buildinglink' OR LOWER(company) = 'buildinglink' LIMIT 1"
  )
  return vendor?.id || null
}

export async function getBuildingLinkMessages(
  options?: {
    category?: BuildingLinkCategory | 'all'
    limit?: number
    offset?: number
    search?: string
  }
): Promise<BuildingLinkMessage[]> {
  const vendorId = await getBuildingLinkVendorId()
  if (!vendorId) return []

  const limit = options?.limit || 100
  const offset = options?.offset || 0
  const search = options?.search

  let sql = `
    SELECT id, subject, body_snippet, body_html, received_at, is_read
    FROM vendor_communications
    WHERE vendor_id = $1
  `
  const params: (string | number)[] = [vendorId]
  let paramIndex = 2

  if (search) {
    sql += ` AND (subject ILIKE $${paramIndex} OR body_snippet ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }

  sql += ` ORDER BY received_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
  params.push(limit, offset)

  const messages = await query<{
    id: string
    subject: string
    body_snippet: string | null
    body_html: string | null
    received_at: string
    is_read: boolean
  }>(sql, params)

  // Categorize each message
  const categorized: BuildingLinkMessage[] = messages.map(msg => {
    const { category, subcategory } = categorizeBuildingLinkMessage(msg.subject, msg.body_snippet)
    const unit = extractUnit(msg.subject, msg.body_snippet)
    return {
      ...msg,
      category,
      subcategory,
      unit,
    }
  })

  // Filter by category if specified
  if (options?.category && options.category !== 'all') {
    return categorized.filter(m => m.category === options.category)
  }

  return categorized
}

export async function getBuildingLinkStats(): Promise<BuildingLinkStats> {
  const vendorId = await getBuildingLinkVendorId()
  if (!vendorId) {
    return { total: 0, unread: 0, critical: 0, important: 0, maintenance: 0, security: 0, todayCount: 0, thisWeekCount: 0 }
  }

  // Get counts
  const stats = await queryOne<{
    total: string
    unread: string
    today_count: string
    week_count: string
  }>(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_read = false) as unread,
      COUNT(*) FILTER (WHERE received_at::date = CURRENT_DATE) as today_count,
      COUNT(*) FILTER (WHERE received_at >= CURRENT_DATE - INTERVAL '7 days') as week_count
    FROM vendor_communications
    WHERE vendor_id = $1
  `, [vendorId])

  // Get all messages to count by category (we need to categorize in app code)
  const messages = await query<{ subject: string; body_snippet: string | null }>(`
    SELECT subject, body_snippet
    FROM vendor_communications
    WHERE vendor_id = $1
  `, [vendorId])

  let critical = 0, important = 0, maintenance = 0, security = 0
  for (const msg of messages) {
    const { category } = categorizeBuildingLinkMessage(msg.subject, msg.body_snippet)
    switch (category) {
      case 'critical': critical++; break
      case 'important': important++; break
      case 'maintenance': maintenance++; break
      case 'security': security++; break
    }
  }

  return {
    total: parseInt(stats?.total || '0'),
    unread: parseInt(stats?.unread || '0'),
    critical,
    important,
    maintenance,
    security,
    todayCount: parseInt(stats?.today_count || '0'),
    thisWeekCount: parseInt(stats?.week_count || '0'),
  }
}

export async function getBuildingLinkCriticalAndImportant(): Promise<BuildingLinkMessage[]> {
  const messages = await getBuildingLinkMessages({ limit: 500 })
  return messages.filter(m => m.category === 'critical' || m.category === 'important')
}

export async function getBuildingLinkSecurityLog(limit = 50): Promise<BuildingLinkMessage[]> {
  const messages = await getBuildingLinkMessages({ limit: 200 })
  return messages.filter(m => m.category === 'security').slice(0, limit)
}

export async function getBuildingLinkMaintenance(): Promise<BuildingLinkMessage[]> {
  const messages = await getBuildingLinkMessages({ limit: 200 })
  return messages.filter(m => m.category === 'maintenance')
}

// ============================================
// BANK TRANSACTION MATCHING
// ============================================

export interface BankTransactionMatch {
  id: string
  import_batch_id: string
  transaction_date: string
  description: string
  amount: number
  check_number: string | null
  matched_bill_id: string | null
  matched_at: string | null
  match_confidence: number | null
  match_method: string | null
  is_confirmed: boolean
  created_at: string
  // Joined bill data if matched
  bill_description?: string
  bill_amount?: number
  property_name?: string
  vendor_name?: string
}

export async function getPendingBankTransactionMatches(): Promise<BankTransactionMatch[]> {
  return query<BankTransactionMatch>(`
    SELECT
      bt.*,
      b.description as bill_description,
      b.amount as bill_amount,
      p.name as property_name,
      v.name as vendor_name
    FROM bank_transactions bt
    LEFT JOIN bills b ON bt.matched_bill_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN vendors v ON b.vendor_id = v.id
    WHERE bt.is_confirmed = FALSE
      AND bt.matched_bill_id IS NOT NULL
    ORDER BY bt.match_confidence DESC, bt.transaction_date DESC
  `)
}

export async function getUnmatchedBankTransactions(): Promise<BankTransactionMatch[]> {
  return query<BankTransactionMatch>(`
    SELECT bt.*
    FROM bank_transactions bt
    WHERE bt.matched_bill_id IS NULL
      AND bt.is_confirmed = FALSE
    ORDER BY bt.transaction_date DESC
  `)
}

export async function getRecentBankImports(): Promise<Array<{
  id: string
  filename: string
  account_type: string | null
  date_range_start: string | null
  date_range_end: string | null
  transaction_count: number
  matched_count: number
  imported_at: string
}>> {
  return query(`
    SELECT *
    FROM bank_import_batches
    ORDER BY imported_at DESC
    LIMIT 10
  `)
}

// ============================================
// CALENDAR EVENTS
// ============================================

export type CalendarEventType =
  | 'bill'
  | 'property_tax'
  | 'insurance_renewal'
  | 'insurance_expiration'
  | 'vehicle_registration'
  | 'vehicle_inspection'
  | 'maintenance'

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  description: string | null
  date: string
  amount: number | null
  status: string | null
  propertyName: string | null
  vehicleName: string | null
  vendorName: string | null
  isOverdue: boolean
  isUrgent: boolean
  href: string | null
}

export async function getCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = []

  // Bills
  const bills = await query<{
    id: string
    description: string | null
    bill_type: string
    amount: number
    due_date: string
    status: string
    property_name: string | null
    vehicle_name: string | null
    vendor_name: string | null
  }>(`
    SELECT
      b.id,
      b.description,
      b.bill_type,
      b.amount,
      b.due_date::text,
      b.status,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
      vn.name as vendor_name
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN vendors vn ON b.vendor_id = vn.id
    WHERE b.due_date BETWEEN $1 AND $2
    ORDER BY b.due_date
  `, [startDate, endDate])

  for (const bill of bills) {
    const isOverdue = bill.status === 'pending' && new Date(bill.due_date) < new Date()
    events.push({
      id: `bill-${bill.id}`,
      type: 'bill',
      title: bill.description || bill.bill_type,
      description: bill.vendor_name,
      date: bill.due_date,
      amount: bill.amount,
      status: bill.status,
      propertyName: bill.property_name,
      vehicleName: bill.vehicle_name,
      vendorName: bill.vendor_name,
      isOverdue,
      isUrgent: isOverdue,
      href: '/payments',
    })
  }

  // Property Taxes
  const taxes = await query<{
    id: string
    jurisdiction: string
    tax_year: number
    installment: number
    amount: number
    due_date: string
    status: string
    property_name: string
  }>(`
    SELECT
      pt.id,
      pt.jurisdiction,
      pt.tax_year,
      pt.installment,
      pt.amount,
      pt.due_date::text,
      pt.status,
      p.name as property_name
    FROM property_taxes pt
    JOIN properties p ON pt.property_id = p.id
    WHERE pt.due_date BETWEEN $1 AND $2
    ORDER BY pt.due_date
  `, [startDate, endDate])

  for (const tax of taxes) {
    const isOverdue = tax.status === 'pending' && new Date(tax.due_date) < new Date()
    events.push({
      id: `tax-${tax.id}`,
      type: 'property_tax',
      title: `${tax.jurisdiction} Q${tax.installment} Tax`,
      description: tax.property_name,
      date: tax.due_date,
      amount: tax.amount,
      status: tax.status,
      propertyName: tax.property_name,
      vehicleName: null,
      vendorName: null,
      isOverdue,
      isUrgent: isOverdue,
      href: '/payments',
    })
  }

  // Insurance Expirations
  const policies = await query<{
    id: string
    carrier_name: string
    policy_type: string
    expiration_date: string
    premium_amount: number | null
    property_name: string | null
    vehicle_name: string | null
  }>(`
    SELECT
      ip.id,
      ip.carrier_name,
      ip.policy_type,
      ip.expiration_date::text,
      ip.premium_amount,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name
    FROM insurance_policies ip
    LEFT JOIN properties p ON ip.property_id = p.id
    LEFT JOIN vehicles v ON ip.vehicle_id = v.id
    WHERE ip.expiration_date BETWEEN $1 AND $2
    ORDER BY ip.expiration_date
  `, [startDate, endDate])

  for (const policy of policies) {
    const daysUntil = Math.ceil((new Date(policy.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    events.push({
      id: `insurance-exp-${policy.id}`,
      type: 'insurance_expiration',
      title: `${policy.carrier_name} ${policy.policy_type} Expires`,
      description: policy.property_name || policy.vehicle_name,
      date: policy.expiration_date,
      amount: policy.premium_amount,
      status: daysUntil < 0 ? 'expired' : 'active',
      propertyName: policy.property_name,
      vehicleName: policy.vehicle_name,
      vendorName: null,
      isOverdue: daysUntil < 0,
      isUrgent: daysUntil <= 30,
      href: '/insurance',
    })
  }

  // Vehicle Registrations
  const registrations = await query<{
    id: string
    year: number
    make: string
    model: string
    registration_expires: string | null
  }>(`
    SELECT id, year, make, model, registration_expires::text
    FROM vehicles
    WHERE registration_expires BETWEEN $1 AND $2
      AND is_active = TRUE
    ORDER BY registration_expires
  `, [startDate, endDate])

  for (const vehicle of registrations) {
    if (vehicle.registration_expires) {
      const daysUntil = Math.ceil((new Date(vehicle.registration_expires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      events.push({
        id: `reg-${vehicle.id}`,
        type: 'vehicle_registration',
        title: `Registration Expires`,
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        date: vehicle.registration_expires,
        amount: null,
        status: daysUntil < 0 ? 'expired' : 'active',
        propertyName: null,
        vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        vendorName: null,
        isOverdue: daysUntil < 0,
        isUrgent: daysUntil <= 30,
        href: `/vehicles/${vehicle.id}`,
      })
    }
  }

  // Vehicle Inspections
  const inspections = await query<{
    id: string
    year: number
    make: string
    model: string
    inspection_expires: string | null
  }>(`
    SELECT id, year, make, model, inspection_expires::text
    FROM vehicles
    WHERE inspection_expires BETWEEN $1 AND $2
      AND is_active = TRUE
    ORDER BY inspection_expires
  `, [startDate, endDate])

  for (const vehicle of inspections) {
    if (vehicle.inspection_expires) {
      const daysUntil = Math.ceil((new Date(vehicle.inspection_expires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      events.push({
        id: `insp-${vehicle.id}`,
        type: 'vehicle_inspection',
        title: `Inspection Due`,
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        date: vehicle.inspection_expires,
        amount: null,
        status: daysUntil < 0 ? 'overdue' : 'active',
        propertyName: null,
        vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        vendorName: null,
        isOverdue: daysUntil < 0,
        isUrgent: daysUntil <= 14,
        href: `/vehicles/${vehicle.id}`,
      })
    }
  }

  // Maintenance Tasks with due dates
  const tasks = await query<{
    id: string
    title: string
    due_date: string
    priority: string
    status: string
    property_name: string | null
    vehicle_name: string | null
    vendor_name: string | null
    estimated_cost: number | null
  }>(`
    SELECT
      mt.id,
      mt.title,
      mt.due_date::text,
      mt.priority,
      mt.status,
      p.name as property_name,
      CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
      vn.name as vendor_name,
      mt.estimated_cost
    FROM maintenance_tasks mt
    LEFT JOIN properties p ON mt.property_id = p.id
    LEFT JOIN vehicles v ON mt.vehicle_id = v.id
    LEFT JOIN vendors vn ON mt.vendor_id = vn.id
    WHERE mt.due_date BETWEEN $1 AND $2
      AND mt.status IN ('pending', 'in_progress')
    ORDER BY mt.due_date
  `, [startDate, endDate])

  for (const task of tasks) {
    const isOverdue = new Date(task.due_date) < new Date()
    events.push({
      id: `task-${task.id}`,
      type: 'maintenance',
      title: task.title,
      description: task.property_name || task.vehicle_name,
      date: task.due_date,
      amount: task.estimated_cost,
      status: task.status,
      propertyName: task.property_name,
      vehicleName: task.vehicle_name,
      vendorName: task.vendor_name,
      isOverdue,
      isUrgent: isOverdue || task.priority === 'urgent' || task.priority === 'high',
      href: '/maintenance',
    })
  }

  // Sort all events by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return events
}

// Get all payments awaiting check confirmation (sent but not confirmed)
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
