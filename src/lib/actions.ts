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
