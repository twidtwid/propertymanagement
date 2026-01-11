"use server"

import { query, queryOne } from "../db"
import {
  getVisibilityContext,
  getVisibleVehicleIds,
} from "../visibility"
import { getPinnedIds } from "./pinning"
import type {
  DashboardStats,
  UpcomingItem,
} from "@/types/database"
import type { VendorCommunication } from "./vendors"

// ============================================
// DASHBOARD QUERIES
// ============================================

/**
 * Get items due in the next 7 days (excluding pinned items)
 * Used for the "Upcoming Week" section on dashboard
 */
export async function getUpcomingWeek(): Promise<UpcomingItem[]> {
  // Phase 1: Get visibility context (cached per-request)
  const [ctx, visibleVehicleIds] = await Promise.all([
    getVisibilityContext(),
    getVisibleVehicleIds()
  ])
  if (!ctx) return []

  // Phase 2: All data queries in parallel (including pinned IDs)
  const [
    pinnedBills,
    pinnedTaxes,
    pinnedTickets,
    bills,
    taxes,
    insurance,
    vehicles,
    tasks
  ] = await Promise.all([
    getPinnedIds('bill'),
    getPinnedIds('property_tax'),
    getPinnedIds('ticket'),
    // Fetch bills due in 7 days
    query<{ id: string; description: string; bill_type: string; amount: string; due_date: string; property_name: string | null }>(
      `SELECT b.id, b.description, b.bill_type, b.amount, b.due_date::text, p.name as property_name
       FROM bills b
       LEFT JOIN properties p ON b.property_id = p.id
       WHERE b.status = 'pending'
         AND b.due_date >= CURRENT_DATE
         AND b.due_date <= CURRENT_DATE + 7
         AND (b.property_id IS NULL OR b.property_id = ANY($1::uuid[]))
         AND (b.vehicle_id IS NULL OR b.vehicle_id = ANY($2::uuid[]))
       ORDER BY b.due_date`,
      [ctx.visiblePropertyIds, visibleVehicleIds]
    ),
    // Fetch property taxes due in 7 days
    query<{ id: string; jurisdiction: string; installment: number; amount: string; due_date: string; property_name: string }>(
      `SELECT pt.id, pt.jurisdiction, pt.installment, pt.amount, pt.due_date::text, p.name as property_name
       FROM property_taxes pt
       JOIN properties p ON pt.property_id = p.id
       WHERE pt.status = 'pending'
         AND pt.due_date >= CURRENT_DATE
         AND pt.due_date <= CURRENT_DATE + 7
         AND pt.property_id = ANY($1::uuid[])
       ORDER BY pt.due_date`,
      [ctx.visiblePropertyIds]
    ),
    // Fetch insurance expirations in 7 days
    query<{ id: string; carrier_name: string; policy_type: string; premium_amount: string | null; expiration_date: string; property_name: string | null; vehicle_name: string | null }>(
      `SELECT ip.id, ip.carrier_name, ip.policy_type, ip.premium_amount, ip.expiration_date::text,
        p.name as property_name,
        CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name
       FROM insurance_policies ip
       LEFT JOIN properties p ON ip.property_id = p.id
       LEFT JOIN vehicles v ON ip.vehicle_id = v.id
       WHERE ip.expiration_date >= CURRENT_DATE
         AND ip.expiration_date <= CURRENT_DATE + 7
         AND (ip.property_id IS NULL OR ip.property_id = ANY($1::uuid[]))
         AND (ip.vehicle_id IS NULL OR ip.vehicle_id = ANY($2::uuid[]))
       ORDER BY ip.expiration_date`,
      [ctx.visiblePropertyIds, visibleVehicleIds]
    ),
    // Fetch vehicle registrations/inspections expiring in 7 days
    query<{ id: string; year: number; make: string; model: string; registration_expires: string | null; inspection_expires: string | null }>(
      `SELECT id, year, make, model, registration_expires::text, inspection_expires::text
       FROM vehicles
       WHERE is_active = TRUE
         AND id = ANY($1::uuid[])
         AND (
           (registration_expires >= CURRENT_DATE AND registration_expires <= CURRENT_DATE + 7)
           OR (inspection_expires >= CURRENT_DATE AND inspection_expires <= CURRENT_DATE + 7)
         )`,
      [visibleVehicleIds]
    ),
    // Fetch maintenance tasks with due dates in 7 days
    query<{ id: string; title: string; due_date: string; property_name: string | null; vehicle_name: string | null }>(
      `SELECT mt.id, mt.title, mt.due_date::text, p.name as property_name,
        CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name
       FROM maintenance_tasks mt
       LEFT JOIN properties p ON mt.property_id = p.id
       LEFT JOIN vehicles v ON mt.vehicle_id = v.id
       WHERE mt.status IN ('pending', 'in_progress')
         AND mt.due_date >= CURRENT_DATE
         AND mt.due_date <= CURRENT_DATE + 7
         AND (mt.property_id IS NULL OR mt.property_id = ANY($1::uuid[]))
         AND (mt.vehicle_id IS NULL OR mt.vehicle_id = ANY($2::uuid[]))
       ORDER BY mt.due_date`,
      [ctx.visiblePropertyIds, visibleVehicleIds]
    )
  ])

  // Helper to calculate days until
  const daysUntil = (dateStr: string): number => {
    const date = new Date(dateStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  const items: UpcomingItem[] = []

  // Add bills (excluding pinned)
  for (const bill of bills) {
    if (pinnedBills.has(bill.id)) continue
    items.push({
      id: bill.id,
      type: 'bill',
      title: bill.description || bill.bill_type,
      subtitle: bill.property_name,
      amount: Number(bill.amount),
      dueDate: bill.due_date,
      daysUntil: daysUntil(bill.due_date),
      href: '/payments',
      icon: 'bill',
    })
  }

  // Add taxes (excluding pinned)
  for (const tax of taxes) {
    if (pinnedTaxes.has(tax.id)) continue
    items.push({
      id: tax.id,
      type: 'tax',
      title: `Property Tax - ${tax.jurisdiction} Q${tax.installment}`,
      subtitle: tax.property_name,
      amount: Number(tax.amount),
      dueDate: tax.due_date,
      daysUntil: daysUntil(tax.due_date),
      href: '/payments',
      icon: 'tax',
    })
  }

  // Add insurance expirations
  for (const ins of insurance) {
    items.push({
      id: ins.id,
      type: 'insurance',
      title: `${ins.carrier_name} - ${ins.policy_type}`,
      subtitle: ins.property_name || ins.vehicle_name,
      amount: ins.premium_amount ? Number(ins.premium_amount) : null,
      dueDate: ins.expiration_date,
      daysUntil: daysUntil(ins.expiration_date),
      href: `/insurance/${ins.id}`,
      icon: 'insurance',
    })
  }

  // Add vehicle registrations/inspections
  for (const veh of vehicles) {
    const vehicleName = `${veh.year} ${veh.make} ${veh.model}`
    if (veh.registration_expires) {
      const days = daysUntil(veh.registration_expires)
      if (days >= 0 && days <= 7) {
        items.push({
          id: `${veh.id}-reg`,
          type: 'registration',
          title: 'Vehicle Registration',
          subtitle: vehicleName,
          amount: null,
          dueDate: veh.registration_expires,
          daysUntil: days,
          href: `/vehicles/${veh.id}`,
          icon: 'car',
        })
      }
    }
    if (veh.inspection_expires) {
      const days = daysUntil(veh.inspection_expires)
      if (days >= 0 && days <= 7) {
        items.push({
          id: `${veh.id}-insp`,
          type: 'inspection',
          title: 'Vehicle Inspection',
          subtitle: vehicleName,
          amount: null,
          dueDate: veh.inspection_expires,
          daysUntil: days,
          href: `/vehicles/${veh.id}`,
          icon: 'car',
        })
      }
    }
  }

  // Add tasks (excluding pinned)
  for (const task of tasks) {
    if (pinnedTickets.has(task.id)) continue
    items.push({
      id: task.id,
      type: 'task',
      title: task.title,
      subtitle: task.property_name || task.vehicle_name,
      amount: null,
      dueDate: task.due_date,
      daysUntil: daysUntil(task.due_date),
      href: `/maintenance/${task.id}`,
      icon: 'ticket',
    })
  }

  // Sort by due date
  items.sort((a, b) => a.daysUntil - b.daysUntil)

  return items
}

/**
 * Get dashboard stats for the new compact stats cards.
 */
export async function getNewDashboardStats(): Promise<DashboardStats> {
  const ctx = await getVisibilityContext()
  if (!ctx) {
    return { properties: 0, vehicles: 0, due30Days: 0 }
  }

  const visibleVehicleIds = await getVisibleVehicleIds()

  const [propertyCount, vehicleCount, due30Days] = await Promise.all([
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM properties WHERE status = 'active' AND id = ANY($1::uuid[])",
      [ctx.visiblePropertyIds]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM vehicles WHERE is_active = TRUE AND id = ANY($1::uuid[])",
      [visibleVehicleIds]
    ),
    queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM (
        SELECT amount FROM bills
        WHERE status = 'pending'
          AND due_date <= CURRENT_DATE + 30
          AND (property_id IS NULL OR property_id = ANY($1::uuid[]))
          AND (vehicle_id IS NULL OR vehicle_id = ANY($2::uuid[]))
        UNION ALL
        SELECT amount FROM property_taxes
        WHERE status = 'pending'
          AND due_date <= CURRENT_DATE + 30
          AND property_id = ANY($1::uuid[])
      ) combined`,
      [ctx.visiblePropertyIds, visibleVehicleIds]
    ),
  ])

  return {
    properties: parseInt(propertyCount?.count || "0"),
    vehicles: parseInt(vehicleCount?.count || "0"),
    due30Days: parseFloat(due30Days?.total || "0"),
  }
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

/**
 * Legacy dashboard stats function (includes upcomingBills and urgentTasks)
 */
export async function getDashboardStats() {
  const ctx = await getVisibilityContext()
  if (!ctx) {
    return { properties: 0, vehicles: 0, upcomingBills: 0, urgentTasks: 0 }
  }

  const visibleVehicleIds = await getVisibleVehicleIds()

  const [
    propertyCount,
    vehicleCount,
    upcomingBillsCount,
    urgentTasksCount,
  ] = await Promise.all([
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM properties WHERE status = 'active' AND id = ANY($1::uuid[])",
      [ctx.visiblePropertyIds]
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM vehicles WHERE is_active = TRUE AND id = ANY($1::uuid[])",
      [visibleVehicleIds]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM bills
       WHERE status = 'pending' AND due_date <= CURRENT_DATE + 30
         AND (property_id IS NULL OR property_id = ANY($1::uuid[]))
         AND (vehicle_id IS NULL OR vehicle_id = ANY($2::uuid[]))`,
      [ctx.visiblePropertyIds, visibleVehicleIds]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM maintenance_tasks
       WHERE status IN ('pending', 'in_progress') AND priority IN ('urgent', 'high')
         AND (property_id IS NULL OR property_id = ANY($1::uuid[]))
         AND (vehicle_id IS NULL OR vehicle_id = ANY($2::uuid[]))`,
      [ctx.visiblePropertyIds, visibleVehicleIds]
    ),
  ])

  return {
    properties: parseInt(propertyCount?.count || "0"),
    vehicles: parseInt(vehicleCount?.count || "0"),
    upcomingBills: parseInt(upcomingBillsCount?.count || "0"),
    urgentTasks: parseInt(urgentTasksCount?.count || "0"),
  }
}
