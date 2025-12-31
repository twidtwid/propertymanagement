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
