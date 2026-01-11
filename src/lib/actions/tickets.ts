"use server"

import { query, queryOne } from "../db"
import { getVisibilityContext } from "../visibility"
import type {
  MaintenanceTask,
  TicketActivity,
  VendorSpecialty,
  Property,
} from "@/types/database"

// ============================================
// TICKET TYPES & INTERFACES
// ============================================

export interface TicketFilters {
  propertyId?: string
  vendorId?: string
  showClosed?: boolean
  search?: string
}

export interface TicketWithDetails extends MaintenanceTask {
  property_name: string | null
  vehicle_name: string | null
  vendor_name: string | null
  vendor_contact_name: string | null
}

// ============================================
// TICKET QUERIES
// ============================================

/**
 * Get tickets with filtering and visibility enforcement
 */
export async function getTickets(filters?: TicketFilters): Promise<TicketWithDetails[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  const conditions: string[] = []
  const params: (string | string[])[] = [ctx.visiblePropertyIds]
  let paramIndex = 2

  // Property must be visible (or vehicle's property must be visible, or vehicle has no property, or no property/vehicle)
  conditions.push(`(
    mt.property_id = ANY($1::uuid[])
    OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($1::uuid[]) OR property_id IS NULL)
    OR (mt.property_id IS NULL AND mt.vehicle_id IS NULL)
  )`)

  // Filter by specific property
  if (filters?.propertyId) {
    conditions.push(`mt.property_id = $${paramIndex}`)
    params.push(filters.propertyId)
    paramIndex++
  }

  // Filter by vendor
  if (filters?.vendorId) {
    conditions.push(`mt.vendor_id = $${paramIndex}`)
    params.push(filters.vendorId)
    paramIndex++
  }

  // Hide closed by default
  if (!filters?.showClosed) {
    conditions.push(`mt.status NOT IN ('completed', 'cancelled')`)
  }

  // Search in title and description
  if (filters?.search) {
    conditions.push(`(mt.title ILIKE $${paramIndex} OR mt.description ILIKE $${paramIndex})`)
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return query<TicketWithDetails>(
    `SELECT
       mt.*,
       p.name as property_name,
       CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
       vnd.company as vendor_name,
       vc.name as vendor_contact_name,
       row_to_json(p.*) as property,
       row_to_json(v.*) as vehicle,
       row_to_json(vnd.*) as vendor,
       row_to_json(vc.*) as vendor_contact
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     LEFT JOIN vendors vnd ON mt.vendor_id = vnd.id
     LEFT JOIN vendor_contacts vc ON mt.vendor_contact_id = vc.id
     ${whereClause}
     ORDER BY
       CASE mt.status
         WHEN 'pending' THEN 1
         WHEN 'in_progress' THEN 2
         ELSE 3
       END,
       CASE mt.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       mt.created_at DESC`,
    params
  )
}

/**
 * Get a single ticket by ID with visibility enforcement
 */
export async function getTicket(id: string): Promise<TicketWithDetails | null> {
  const ctx = await getVisibilityContext()
  if (!ctx) {
    console.log("[getTicket] No visibility context - user not authenticated")
    return null
  }

  // Even if visiblePropertyIds is empty, we should still query for tickets
  // with null property_id/vehicle_id (they're visible to everyone)
  const ticket = await queryOne<TicketWithDetails>(
    `SELECT
       mt.id, mt.property_id, mt.vehicle_id, mt.equipment_id, mt.vendor_id, mt.vendor_contact_id,
       mt.title, mt.description, mt.priority, mt.due_date::text, mt.completed_date::text,
       mt.recurrence, mt.status, mt.estimated_cost, mt.actual_cost, mt.resolution,
       mt.resolved_at::text, mt.resolved_by, mt.notes, mt.created_at::text, mt.updated_at::text,
       p.name as property_name,
       CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name,
       vnd.company as vendor_name,
       vc.name as vendor_contact_name,
       row_to_json(p.*) as property,
       row_to_json(v.*) as vehicle,
       row_to_json(vnd.*) as vendor,
       row_to_json(vc.*) as vendor_contact
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     LEFT JOIN vendors vnd ON mt.vendor_id = vnd.id
     LEFT JOIN vendor_contacts vc ON mt.vendor_contact_id = vc.id
     WHERE mt.id = $1
       AND (
         mt.property_id = ANY($2::uuid[])
         OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($2::uuid[]) OR property_id IS NULL)
         OR (mt.property_id IS NULL AND mt.vehicle_id IS NULL)
       )`,
    [id, ctx.visiblePropertyIds]
  )

  if (!ticket) {
    console.log("[getTicket] Ticket not found or not visible", {
      id,
      userId: ctx.userId,
      visiblePropertyCount: ctx.visiblePropertyIds.length
    })
  }

  return ticket
}

/**
 * Get activity log for a ticket
 */
export async function getTicketActivity(ticketId: string): Promise<TicketActivity[]> {
  return query<TicketActivity>(
    `SELECT * FROM ticket_activity WHERE ticket_id = $1 ORDER BY created_at DESC`,
    [ticketId]
  )
}

/**
 * Get tickets for a specific property
 */
export async function getTicketsForProperty(propertyId: string, showClosed = false): Promise<TicketWithDetails[]> {
  return getTickets({ propertyId, showClosed })
}

/**
 * Get count of open tickets (not completed or cancelled)
 */
export async function getOpenTicketCount(): Promise<number> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return 0

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM maintenance_tasks mt
     WHERE mt.status NOT IN ('completed', 'cancelled')
       AND (
         mt.property_id = ANY($1::uuid[])
         OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($1::uuid[]) OR property_id IS NULL)
         OR (mt.property_id IS NULL AND mt.vehicle_id IS NULL)
       )`,
    [ctx.visiblePropertyIds]
  )

  return parseInt(result?.count || '0', 10)
}

// ============================================
// GLOBAL SEARCH
// ============================================

export interface SearchResult {
  type: "property" | "vehicle" | "vendor" | "bill" | "task"
  id: string
  title: string
  subtitle: string
  href: string
}

/**
 * Global search across properties, vehicles, vendors, and tasks
 */
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
    query<{ id: string; name: string; company: string; specialties: VendorSpecialty[] }>(
      `SELECT id, name, company, specialties FROM vendors
       WHERE LOWER(name) LIKE $1 OR LOWER(company) LIKE $1 OR EXISTS (SELECT 1 FROM unnest(specialties) s WHERE s::text ILIKE $1)
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
      subtitle: `${p.city}${p.state ? `, ${p.state}` : ''}`,
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
      title: v.company || v.name,
      subtitle: v.specialties.join(", "),
      href: `/vendors/${v.id}`,
    })
  })

  tasks.forEach((t) => {
    results.push({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: `Priority: ${t.priority}`,
      href: `/maintenance/${t.id}`,
    })
  })

  return results
}
