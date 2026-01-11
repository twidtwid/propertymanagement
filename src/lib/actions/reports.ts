"use server"

import { query, queryOne } from "../db"
import {
  getVisibilityContext,
  getVisibleVendorIds,
} from "../visibility"
import type {
  Bill,
  Property,
  PropertyTax,
  MaintenanceTask,
  InsurancePolicy,
  Vendor,
  VendorSpecialty,
} from "@/types/database"

// ============================================
// PAYMENT SUMMARY REPORT
// ============================================

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

// ============================================
// PROPERTY VALUES REPORT
// ============================================

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

// ============================================
// TAX CALENDAR REPORT
// ============================================

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

// ============================================
// MAINTENANCE COSTS REPORT
// ============================================

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

// ============================================
// INSURANCE COVERAGE REPORT
// ============================================

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

// ============================================
// YEAR-END EXPORT REPORT
// ============================================

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
// VENDOR REPORT
// ============================================

export interface VendorReportItem extends Vendor {
  properties: Array<{ id: string; name: string; state: string | null; country: string }>
  ticket_count: number
  open_ticket_count: number
  total_spent: number
  primary_contact_name: string | null
  primary_contact_title: string | null
  primary_contact_phone: string | null
  primary_contact_email: string | null
}

export interface VendorReportFilters {
  specialty?: string
  region?: string
  property?: string
  groupBy?: 'vendor' | 'region' | 'property' | 'specialty'
}

export async function getVendorReport(filters?: VendorReportFilters): Promise<{
  vendors: VendorReportItem[]
  regions: string[]
  specialties: string[]
}> {
  const visibleVendorIds = await getVisibleVendorIds()
  if (visibleVendorIds.length === 0) return { vendors: [], regions: [], specialties: [] }

  const ctx = await getVisibilityContext()
  if (!ctx) return { vendors: [], regions: [], specialties: [] }

  // Get all vendors with their properties, ticket counts, spending, and primary contact
  const vendors = await query<Vendor & {
    property_data: string | null
    ticket_count: string
    open_ticket_count: string
    total_spent: string
    primary_contact_name: string | null
    primary_contact_title: string | null
    primary_contact_phone: string | null
    primary_contact_email: string | null
  }>(`
    WITH vendor_properties AS (
      SELECT
        pv.vendor_id,
        json_agg(json_build_object(
          'id', p.id,
          'name', p.name,
          'state', p.state,
          'country', p.country
        )) as properties
      FROM property_vendors pv
      JOIN properties p ON pv.property_id = p.id
      WHERE p.id = ANY($2::uuid[])
      GROUP BY pv.vendor_id
    ),
    vendor_tickets AS (
      SELECT
        vendor_id,
        COUNT(*) as ticket_count,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')) as open_ticket_count
      FROM maintenance_tasks
      WHERE vendor_id IS NOT NULL
      GROUP BY vendor_id
    ),
    vendor_spending AS (
      SELECT
        vendor_id,
        COALESCE(SUM(actual_cost), 0) as total_spent
      FROM maintenance_tasks
      WHERE vendor_id IS NOT NULL AND actual_cost IS NOT NULL
      GROUP BY vendor_id
    ),
    primary_contacts AS (
      SELECT DISTINCT ON (vendor_id)
        vendor_id,
        name as contact_name,
        title as contact_title,
        phone as contact_phone,
        email as contact_email
      FROM vendor_contacts
      WHERE is_primary = true
    )
    SELECT
      v.*,
      vp.properties::text as property_data,
      COALESCE(vt.ticket_count, 0) as ticket_count,
      COALESCE(vt.open_ticket_count, 0) as open_ticket_count,
      COALESCE(vs.total_spent, 0) as total_spent,
      pc.contact_name as primary_contact_name,
      pc.contact_title as primary_contact_title,
      pc.contact_phone as primary_contact_phone,
      pc.contact_email as primary_contact_email
    FROM vendors v
    LEFT JOIN vendor_properties vp ON v.id = vp.vendor_id
    LEFT JOIN vendor_tickets vt ON v.id = vt.vendor_id
    LEFT JOIN vendor_spending vs ON v.id = vs.vendor_id
    LEFT JOIN primary_contacts pc ON v.id = pc.vendor_id
    WHERE v.id = ANY($1::uuid[])
    ORDER BY COALESCE(v.company, v.name)
  `, [visibleVendorIds, ctx.visiblePropertyIds])

  // Transform results
  let result: VendorReportItem[] = vendors.map(v => ({
    ...v,
    properties: v.property_data ? JSON.parse(v.property_data) : [],
    ticket_count: parseInt(v.ticket_count) || 0,
    open_ticket_count: parseInt(v.open_ticket_count) || 0,
    total_spent: parseFloat(v.total_spent) || 0,
    primary_contact_name: v.primary_contact_name,
    primary_contact_title: v.primary_contact_title,
    primary_contact_phone: v.primary_contact_phone,
    primary_contact_email: v.primary_contact_email,
  }))

  // Apply filters
  if (filters?.specialty && filters.specialty !== 'all') {
    result = result.filter(v => v.specialties.includes(filters.specialty as VendorSpecialty))
  }

  if (filters?.region && filters.region !== 'all') {
    const region = filters.region
    result = result.filter(v =>
      v.properties.some(p => p.state === region || p.country === region)
    )
  }

  if (filters?.property && filters.property !== 'all') {
    result = result.filter(v =>
      v.properties.some(p => p.id === filters.property)
    )
  }

  // Get unique regions and specialties for filter dropdowns
  const allRegions = new Set<string>()
  const allSpecialties = new Set<string>()
  result.forEach(v => {
    v.properties.forEach(p => {
      if (p.state) allRegions.add(p.state)
      else if (p.country !== 'USA') allRegions.add(p.country)
    })
    v.specialties.forEach(s => allSpecialties.add(s))
  })

  return {
    vendors: result,
    regions: Array.from(allRegions).sort(),
    specialties: Array.from(allSpecialties).sort(),
  }
}

// ============================================
// TICKET REPORT
// ============================================

export interface TicketReportItem extends MaintenanceTask {
  property_name: string | null
  property_state: string | null
  vendor_name: string | null
  vendor_company: string | null
}

export interface TicketReportFilters {
  property?: string
  vendor?: string
  status?: string
  priority?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: 'property' | 'vendor' | 'date' | 'priority' | 'status'
}

export async function getTicketReport(filters?: TicketReportFilters): Promise<{
  tickets: TicketReportItem[]
  byProperty: Record<string, TicketReportItem[]>
  byVendor: Record<string, TicketReportItem[]>
  stats: {
    total: number
    open: number
    completed: number
    totalCost: number
  }
}> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) {
    return { tickets: [], byProperty: {}, byVendor: {}, stats: { total: 0, open: 0, completed: 0, totalCost: 0 } }
  }

  const conditions: string[] = []
  const params: (string | string[])[] = [ctx.visiblePropertyIds]
  let paramIndex = 2

  // Property must be visible (or vehicle has no property)
  conditions.push(`(
    mt.property_id = ANY($1::uuid[])
    OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($1::uuid[]) OR property_id IS NULL)
    OR (mt.property_id IS NULL AND mt.vehicle_id IS NULL)
  )`)

  if (filters?.property && filters.property !== 'all') {
    conditions.push(`mt.property_id = $${paramIndex}`)
    params.push(filters.property)
    paramIndex++
  }

  if (filters?.vendor && filters.vendor !== 'all') {
    conditions.push(`mt.vendor_id = $${paramIndex}`)
    params.push(filters.vendor)
    paramIndex++
  }

  if (filters?.status && filters.status !== 'all') {
    conditions.push(`mt.status = $${paramIndex}`)
    params.push(filters.status)
    paramIndex++
  }

  if (filters?.priority && filters.priority !== 'all') {
    conditions.push(`mt.priority = $${paramIndex}`)
    params.push(filters.priority)
    paramIndex++
  }

  if (filters?.dateFrom) {
    conditions.push(`COALESCE(mt.completed_date, mt.due_date, mt.created_at) >= $${paramIndex}`)
    params.push(filters.dateFrom)
    paramIndex++
  }

  if (filters?.dateTo) {
    conditions.push(`COALESCE(mt.completed_date, mt.due_date, mt.created_at) <= $${paramIndex}`)
    params.push(filters.dateTo)
    paramIndex++
  }

  // Determine sort order
  let orderBy = 'mt.created_at DESC'
  if (filters?.sortBy === 'property') orderBy = 'p.name ASC, mt.created_at DESC'
  else if (filters?.sortBy === 'vendor') orderBy = 'COALESCE(vd.company, vd.name) ASC, mt.created_at DESC'
  else if (filters?.sortBy === 'date') orderBy = 'COALESCE(mt.completed_date, mt.due_date, mt.created_at) DESC'
  else if (filters?.sortBy === 'priority') orderBy = "CASE mt.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, mt.created_at DESC"
  else if (filters?.sortBy === 'status') orderBy = "CASE mt.status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END, mt.created_at DESC"

  const tickets = await query<TicketReportItem>(`
    SELECT
      mt.*,
      p.name as property_name,
      p.state as property_state,
      vd.name as vendor_name,
      vd.company as vendor_company
    FROM maintenance_tasks mt
    LEFT JOIN properties p ON mt.property_id = p.id
    LEFT JOIN vendors vd ON mt.vendor_id = vd.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy}
  `, params)

  // Group by property
  const byProperty: Record<string, TicketReportItem[]> = {}
  tickets.forEach(t => {
    const key = t.property_name || 'No Property'
    if (!byProperty[key]) byProperty[key] = []
    byProperty[key].push(t)
  })

  // Group by vendor
  const byVendor: Record<string, TicketReportItem[]> = {}
  tickets.forEach(t => {
    const key = t.vendor_company || t.vendor_name || 'No Vendor'
    if (!byVendor[key]) byVendor[key] = []
    byVendor[key].push(t)
  })

  // Calculate stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    completed: tickets.filter(t => t.status === 'completed').length,
    totalCost: tickets.reduce((sum, t) => sum + (Number(t.actual_cost) || 0), 0),
  }

  return { tickets, byProperty, byVendor, stats }
}

// ============================================
// WEEKLY TICKET REPORT
// ============================================

export interface WeeklyTicketSummary {
  weekStart: string
  weekEnd: string
  byProperty: Record<string, {
    property_name: string
    tickets: TicketReportItem[]
    count: number
    cost: number
  }>
  byVendor: Record<string, {
    vendor_name: string
    tickets: TicketReportItem[]
    count: number
    cost: number
  }>
  totalCount: number
  totalCost: number
}

export async function getWeeklyTicketReport(weeksBack: number = 4): Promise<WeeklyTicketSummary[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  // Get tickets from the last N weeks
  const tickets = await query<TicketReportItem>(`
    SELECT
      mt.*,
      p.name as property_name,
      p.state as property_state,
      vd.name as vendor_name,
      vd.company as vendor_company
    FROM maintenance_tasks mt
    LEFT JOIN properties p ON mt.property_id = p.id
    LEFT JOIN vendors vd ON mt.vendor_id = vd.id
    WHERE (
      mt.property_id = ANY($1::uuid[])
      OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($1::uuid[]) OR property_id IS NULL)
      OR (mt.property_id IS NULL AND mt.vehicle_id IS NULL)
    )
    AND COALESCE(mt.completed_date, mt.due_date, mt.created_at) >= CURRENT_DATE - ($2::INTEGER * 7)
    ORDER BY COALESCE(mt.completed_date, mt.due_date, mt.created_at) DESC
  `, [ctx.visiblePropertyIds, weeksBack])

  // Group tickets by week
  const weeklyData: Map<string, WeeklyTicketSummary> = new Map()

  tickets.forEach(ticket => {
    const ticketDate = new Date(ticket.completed_date || ticket.due_date || ticket.created_at)
    // Get Monday of the week
    const day = ticketDate.getDay()
    const diff = ticketDate.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(ticketDate)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const weekKey = weekStart.toISOString().split('T')[0]

    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, {
        weekStart: weekKey,
        weekEnd: weekEnd.toISOString().split('T')[0],
        byProperty: {},
        byVendor: {},
        totalCount: 0,
        totalCost: 0,
      })
    }

    const week = weeklyData.get(weekKey)!
    week.totalCount++
    week.totalCost += Number(ticket.actual_cost) || 0

    // Group by property
    const propertyKey = ticket.property_name || 'No Property'
    if (!week.byProperty[propertyKey]) {
      week.byProperty[propertyKey] = {
        property_name: propertyKey,
        tickets: [],
        count: 0,
        cost: 0,
      }
    }
    week.byProperty[propertyKey].tickets.push(ticket)
    week.byProperty[propertyKey].count++
    week.byProperty[propertyKey].cost += Number(ticket.actual_cost) || 0

    // Group by vendor
    const vendorKey = ticket.vendor_company || ticket.vendor_name || 'No Vendor'
    if (!week.byVendor[vendorKey]) {
      week.byVendor[vendorKey] = {
        vendor_name: vendorKey,
        tickets: [],
        count: 0,
        cost: 0,
      }
    }
    week.byVendor[vendorKey].tickets.push(ticket)
    week.byVendor[vendorKey].count++
    week.byVendor[vendorKey].cost += Number(ticket.actual_cost) || 0
  })

  // Sort by week start date (most recent first)
  return Array.from(weeklyData.values()).sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart)
  )
}
