"use server"

import { query, queryOne } from "./db"
import {
  getVisibilityContext,
  getVisibleVehicleIds,
  getVisibleVendorIds,
} from "./visibility"
import type {
  Property,
  Vehicle,
  Vendor,
  VendorContact,
  Bill,
  PropertyTax,
  InsurancePolicy,
  MaintenanceTask,
  PropertyVendor,
  SharedTaskList,
  SharedTaskItem,
  UnifiedPayment,
  TicketActivity,
  PinnedEntityType,
  PinNote,
  PaymentStatus,
  TaskPriority,
  TaskStatus,
  DashboardPinnedItem,
  DashboardPinStatus,
  UpcomingItem,
  DashboardStats,
} from "@/types/database"

// Properties
export async function getProperties(): Promise<Property[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  return query<Property>(
    `SELECT * FROM properties WHERE id = ANY($1::uuid[]) ORDER BY name`,
    [ctx.visiblePropertyIds]
  )
}

export async function getProperty(id: string): Promise<Property | null> {
  const ctx = await getVisibilityContext()
  if (!ctx || !ctx.visiblePropertyIds.includes(id)) return null

  return queryOne<Property>("SELECT * FROM properties WHERE id = $1", [id])
}

export async function getActiveProperties(): Promise<Property[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  return query<Property>(
    `SELECT * FROM properties WHERE status = 'active' AND id = ANY($1::uuid[]) ORDER BY name`,
    [ctx.visiblePropertyIds]
  )
}

// Vehicles
export async function getVehicles(): Promise<Vehicle[]> {
  const visibleIds = await getVisibleVehicleIds()
  if (visibleIds.length === 0) return []

  return query<Vehicle>(
    `SELECT * FROM vehicles WHERE id = ANY($1::uuid[]) ORDER BY year DESC, make, model`,
    [visibleIds]
  )
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const visibleIds = await getVisibleVehicleIds()
  if (!visibleIds.includes(id)) return null

  return queryOne<Vehicle>("SELECT * FROM vehicles WHERE id = $1", [id])
}

export async function getActiveVehicles(): Promise<Vehicle[]> {
  const visibleIds = await getVisibleVehicleIds()
  if (visibleIds.length === 0) return []

  return query<Vehicle>(
    `SELECT * FROM vehicles WHERE is_active = TRUE AND id = ANY($1::uuid[]) ORDER BY year DESC, make, model`,
    [visibleIds]
  )
}

// Vendors
export async function getVendors(): Promise<Vendor[]> {
  const visibleIds = await getVisibleVendorIds()
  if (visibleIds.length === 0) return []

  return query<Vendor>(
    `SELECT * FROM vendors WHERE id = ANY($1::uuid[]) ORDER BY name`,
    [visibleIds]
  )
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const visibleIds = await getVisibleVendorIds()
  if (!visibleIds.includes(id)) return null

  const vendor = await queryOne<Vendor>("SELECT * FROM vendors WHERE id = $1", [id])
  if (vendor) {
    vendor.contacts = await getVendorContacts(id)
    vendor.primary_contact = vendor.contacts.find(c => c.is_primary) || null
  }
  return vendor
}

export async function getVendorContacts(vendorId: string): Promise<VendorContact[]> {
  return query<VendorContact>(
    `SELECT * FROM vendor_contacts WHERE vendor_id = $1 ORDER BY is_primary DESC, name`,
    [vendorId]
  )
}

export async function getActiveVendors(): Promise<Vendor[]> {
  const visibleIds = await getVisibleVendorIds()
  if (visibleIds.length === 0) return []

  return query<Vendor>(
    `SELECT * FROM vendors WHERE is_active = TRUE AND id = ANY($1::uuid[]) ORDER BY name`,
    [visibleIds]
  )
}

export async function getVendorsBySpecialty(specialty: string): Promise<Vendor[]> {
  const visibleIds = await getVisibleVendorIds()
  if (visibleIds.length === 0) return []

  return query<Vendor>(
    `SELECT * FROM vendors WHERE specialty = $1 AND is_active = TRUE AND id = ANY($2::uuid[]) ORDER BY rating DESC NULLS LAST, name`,
    [specialty, visibleIds]
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
  const visibleVendorIds = await getVisibleVendorIds()
  if (visibleVendorIds.length === 0) return []

  const ctx = await getVisibilityContext()
  if (!ctx) return []

  // Base query gets vendors with their associated property locations
  // Only include locations from visible properties
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
    LEFT JOIN properties p ON pv.property_id = p.id AND p.id = ANY($2::uuid[])
    WHERE v.id = ANY($1::uuid[])
    GROUP BY v.id
    ORDER BY COALESCE(v.company, v.name)
  `, [visibleVendorIds, ctx.visiblePropertyIds])

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

// Get user's starred vendor IDs
export async function getStarredVendorIds(userId: string): Promise<Set<string>> {
  const stars = await query<{ vendor_id: string }>(
    `SELECT vendor_id FROM user_starred_vendors WHERE user_id = $1`,
    [userId]
  )
  return new Set(stars.map(s => s.vendor_id))
}

// Toggle star on a vendor for a user
export async function toggleVendorStar(
  vendorId: string,
  userId: string
): Promise<boolean> {
  // Check if already starred
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM user_starred_vendors WHERE vendor_id = $1 AND user_id = $2`,
    [vendorId, userId]
  )

  if (existing) {
    // Unstar
    await query(
      `DELETE FROM user_starred_vendors WHERE vendor_id = $1 AND user_id = $2`,
      [vendorId, userId]
    )
    return false
  } else {
    // Star
    await query(
      `INSERT INTO user_starred_vendors (vendor_id, user_id) VALUES ($1, $2)`,
      [vendorId, userId]
    )
    return true
  }
}

// ============================================================================
// UNIFIED PINNING SYSTEM (Shared across all users)
// ============================================================================

/**
 * Get all pinned item IDs for a specific entity type (both system and user pins)
 * Returns Set for fast O(1) lookups in UI components
 */
export async function getPinnedIds(entityType: PinnedEntityType): Promise<Set<string>> {
  const rows = await query<{ entity_id: string }>(
    `SELECT entity_id FROM pinned_items WHERE entity_type = $1`,
    [entityType]
  )
  return new Set(rows.map(r => r.entity_id))
}

/**
 * Get smart pins and user pins separately for a specific entity type
 * Returns object with two Sets: smartPins and userPins
 * Excludes dismissed items
 */
export async function getSmartAndUserPins(entityType: PinnedEntityType): Promise<{
  smartPins: Set<string>
  userPins: Set<string>
}> {
  const rows = await query<{ entity_id: string; is_system_pin: boolean }>(
    `SELECT entity_id, is_system_pin FROM pinned_items
     WHERE entity_type = $1 AND dismissed_at IS NULL`,
    [entityType]
  )

  const smartPins = new Set<string>()
  const userPins = new Set<string>()

  for (const row of rows) {
    if (row.is_system_pin) {
      smartPins.add(row.entity_id)
    } else {
      userPins.add(row.entity_id)
    }
  }

  return { smartPins, userPins }
}

/**
 * Create or update a smart pin (system-generated)
 * Smart pins are automatically managed by the system based on urgency/attention rules
 * Respects user dismissals - will not re-pin dismissed items
 */
export async function upsertSmartPin(params: {
  entityType: PinnedEntityType
  entityId: string
  metadata?: Record<string, any>
}): Promise<void> {
  // Check if this item was dismissed by user
  const dismissed = await queryOne<{ dismissed_at: string | null }>(
    `SELECT dismissed_at FROM pinned_items
     WHERE entity_type = $1 AND entity_id = $2`,
    [params.entityType, params.entityId]
  )

  // Don't re-pin if user dismissed it
  if (dismissed && dismissed.dismissed_at) {
    return
  }

  await query(
    `INSERT INTO pinned_items (entity_type, entity_id, is_system_pin, metadata, pinned_by_name, dismissed_at)
     VALUES ($1, $2, true, $3, 'System', NULL)
     ON CONFLICT (entity_type, entity_id)
     DO UPDATE SET
       metadata = EXCLUDED.metadata,
       is_system_pin = true,
       dismissed_at = NULL`,
    [
      params.entityType,
      params.entityId,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  )
}

/**
 * Remove a smart pin (when item no longer needs attention)
 */
export async function removeSmartPin(entityType: PinnedEntityType, entityId: string): Promise<void> {
  await query(
    `DELETE FROM pinned_items
     WHERE entity_type = $1 AND entity_id = $2 AND is_system_pin = true`,
    [entityType, entityId]
  )
}

/**
 * Toggle pin state (shared across all users)
 * - User pins: Deleted when unpinned
 * - Smart pins: Marked as dismissed (won't come back) when unpinned
 * - Only creates user pins (never creates smart pins manually)
 * Returns true if now pinned, false if unpinned
 */
export async function togglePin(params: {
  entityType: PinnedEntityType
  entityId: string
  userId: string
  userName: string
  metadata?: Record<string, any>
}): Promise<boolean> {
  const existing = await queryOne<{ id: string; is_system_pin: boolean }>(
    `SELECT id, is_system_pin FROM pinned_items
     WHERE entity_type = $1 AND entity_id = $2 AND dismissed_at IS NULL`,
    [params.entityType, params.entityId]
  )

  if (existing) {
    if (existing.is_system_pin) {
      // Dismiss smart pin (mark as dismissed, don't delete)
      await query(
        `UPDATE pinned_items
         SET dismissed_at = NOW()
         WHERE entity_type = $1 AND entity_id = $2`,
        [params.entityType, params.entityId]
      )
    } else {
      // Delete user pin completely
      await query(
        `DELETE FROM pinned_items
         WHERE entity_type = $1 AND entity_id = $2`,
        [params.entityType, params.entityId]
      )
    }
    return false
  } else {
    // Create user pin (never creates smart pins manually)
    await query(
      `INSERT INTO pinned_items (entity_type, entity_id, pinned_by, pinned_by_name, metadata, is_system_pin, dismissed_at)
       VALUES ($1, $2, $3, $4, $5, false, NULL)
       ON CONFLICT (entity_type, entity_id)
       DO UPDATE SET
         pinned_by = EXCLUDED.pinned_by,
         pinned_by_name = EXCLUDED.pinned_by_name,
         metadata = EXCLUDED.metadata,
         is_system_pin = false,
         dismissed_at = NULL`,
      [
        params.entityType,
        params.entityId,
        params.userId,
        params.userName,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    )
    return true
  }
}

/**
 * Undo dismissal of a smart pin (restore it to active)
 * Returns true if successfully restored
 */
export async function undoDismissPin(params: {
  entityType: PinnedEntityType
  entityId: string
}): Promise<boolean> {
  const restored = await queryOne<{ id: string }>(
    `UPDATE pinned_items
     SET dismissed_at = NULL,
         dismissed_by = NULL,
         dismissed_by_name = NULL
     WHERE entity_type = $1
       AND entity_id = $2
       AND is_system_pin = true
       AND dismissed_at IS NOT NULL
     RETURNING id`,
    [params.entityType, params.entityId]
  )

  return restored !== null
}

// ============================================================================
// PIN NOTES
// ============================================================================

/**
 * Get all notes for a specific pinned item
 */
export async function getPinNotes(
  entityType: PinnedEntityType,
  entityId: string
): Promise<PinNote[]> {
  return query<PinNote>(
    `SELECT * FROM pin_notes
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at ASC`,
    [entityType, entityId]
  )
}

/**
 * Get notes for multiple pinned items (for displaying notes in bulk)
 */
export async function getPinNotesByEntities(
  entityType: PinnedEntityType,
  entityIds: string[]
): Promise<Map<string, PinNote[]>> {
  if (entityIds.length === 0) return new Map()

  const notes = await query<PinNote>(
    `SELECT * FROM pin_notes
     WHERE entity_type = $1 AND entity_id = ANY($2::uuid[])
     ORDER BY created_at ASC`,
    [entityType, entityIds]
  )

  const notesByEntity = new Map<string, PinNote[]>()
  for (const note of notes) {
    const existing = notesByEntity.get(note.entity_id) || []
    existing.push(note)
    notesByEntity.set(note.entity_id, existing)
  }

  return notesByEntity
}

/**
 * Get a user's note for a specific pinned item (if exists)
 */
export async function getUserPinNote(
  entityType: PinnedEntityType,
  entityId: string,
  userId: string
): Promise<PinNote | null> {
  return queryOne<PinNote>(
    `SELECT * FROM pin_notes
     WHERE entity_type = $1 AND entity_id = $2 AND user_id = $3`,
    [entityType, entityId, userId]
  )
}

/**
 * Get all pinned items with full entity details (for daily summary)
 */
export async function getAllPinnedItems(): Promise<{
  vendors: VendorWithLocations[]
  bills: Bill[]
  insurancePolicies: InsurancePolicy[]
  tickets: MaintenanceTask[]
  buildingLinkMessages: VendorCommunication[]
}> {
  // Fetch all pinned IDs by type
  const [vendorIds, billIds, insuranceIds, ticketIds, blIds] = await Promise.all([
    getPinnedIds('vendor'),
    getPinnedIds('bill'),
    getPinnedIds('insurance_policy'),
    getPinnedIds('ticket'),
    getPinnedIds('buildinglink_message'),
  ])

  // Fetch full entity details for each pinned item
  const [vendors, bills, insurancePolicies, tickets, buildingLinkMessages] = await Promise.all([
    // Vendors with locations
    vendorIds.size > 0
      ? query<VendorWithLocations>(
          `SELECT v.*,
            ARRAY_AGG(DISTINCT p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL) as locations
          FROM vendors v
          LEFT JOIN property_vendors pv ON v.id = pv.vendor_id
          LEFT JOIN properties p ON pv.property_id = p.id
          WHERE v.id = ANY($1::UUID[])
          GROUP BY v.id
          ORDER BY COALESCE(v.company, v.name)`,
          [Array.from(vendorIds)]
        )
      : [],

    // Bills with related entities
    billIds.size > 0
      ? query<Bill>(
          `SELECT b.*,
            row_to_json(p.*) as property,
            row_to_json(veh.*) as vehicle,
            row_to_json(v.*) as vendor
          FROM bills b
          LEFT JOIN properties p ON b.property_id = p.id
          LEFT JOIN vehicles veh ON b.vehicle_id = veh.id
          LEFT JOIN vendors v ON b.vendor_id = v.id
          WHERE b.id = ANY($1::UUID[])
          ORDER BY
            CASE b.status
              WHEN 'pending' THEN 1
              WHEN 'sent' THEN 2
              WHEN 'overdue' THEN 3
              ELSE 4
            END,
            b.due_date`,
          [Array.from(billIds)]
        )
      : [],

    // Insurance policies
    insuranceIds.size > 0
      ? query<InsurancePolicy>(
          `SELECT ip.*,
            row_to_json(p.*) as property,
            row_to_json(v.*) as vehicle
          FROM insurance_policies ip
          LEFT JOIN properties p ON ip.property_id = p.id
          LEFT JOIN vehicles v ON ip.vehicle_id = v.id
          WHERE ip.id = ANY($1::UUID[])
          ORDER BY ip.expiration_date NULLS LAST`,
          [Array.from(insuranceIds)]
        )
      : [],

    // Tickets/maintenance tasks
    ticketIds.size > 0
      ? query<MaintenanceTask>(
          `SELECT mt.*,
            row_to_json(p.*) as property,
            row_to_json(veh.*) as vehicle,
            row_to_json(v.*) as vendor,
            row_to_json(vc.*) as vendor_contact
          FROM maintenance_tasks mt
          LEFT JOIN properties p ON mt.property_id = p.id
          LEFT JOIN vehicles veh ON mt.vehicle_id = veh.id
          LEFT JOIN vendors v ON mt.vendor_id = v.id
          LEFT JOIN vendor_contacts vc ON mt.vendor_contact_id = vc.id
          WHERE mt.id = ANY($1::UUID[])
          ORDER BY
            CASE mt.priority
              WHEN 'urgent' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              ELSE 4
            END,
            mt.created_at DESC`,
          [Array.from(ticketIds)]
        )
      : [],

    // BuildingLink messages
    blIds.size > 0
      ? query<VendorCommunication>(
          `SELECT vc.*,
            row_to_json(v.*) as vendor
          FROM vendor_communications vc
          LEFT JOIN vendors v ON vc.vendor_id = v.id
          WHERE vc.id = ANY($1::UUID[])
          ORDER BY vc.received_at DESC`,
          [Array.from(blIds)]
        )
      : [],
  ])

  return {
    vendors,
    bills,
    insurancePolicies,
    tickets,
    buildingLinkMessages,
  }
}

/**
 * Sync smart pins for bills based on business rules
 * Auto-pins: overdue, awaiting confirmation >14 days, due within 7 days
 */
export async function syncSmartPinsBills(): Promise<void> {
  // Get bills that need attention
  const bills = await query<{ id: string; description: string; amount: string; due_date: string; status: PaymentStatus }>(
    `SELECT id, description, amount, due_date, status
     FROM bills
     WHERE (
       -- Overdue
       (status = 'pending' AND due_date < CURRENT_DATE)
       -- Awaiting confirmation >14 days
       OR (status = 'sent' AND payment_date IS NOT NULL AND confirmation_date IS NULL
           AND payment_date < CURRENT_DATE - INTERVAL '14 days')
       -- Due within 7 days
       OR (status = 'pending' AND due_date <= CURRENT_DATE + INTERVAL '7 days' AND due_date >= CURRENT_DATE)
     )`
  )

  // Get currently smart-pinned bills
  const currentSmartPins = await query<{ entity_id: string }>(
    `SELECT entity_id FROM pinned_items WHERE entity_type = 'bill' AND is_system_pin = true`
  )
  const currentSet = new Set(currentSmartPins.map(p => p.entity_id))

  // Pin bills that need attention
  for (const bill of bills) {
    await upsertSmartPin({
      entityType: 'bill',
      entityId: bill.id,
      metadata: {
        title: bill.description,
        amount: Number(bill.amount),
        dueDate: bill.due_date,
        status: bill.status,
      },
    })
    currentSet.delete(bill.id) // Remove from set
  }

  // Unpin bills that no longer need attention
  for (const billId of Array.from(currentSet)) {
    await removeSmartPin('bill', billId)
  }
}

/**
 * Sync smart pins for tickets based on business rules
 * Auto-pins: urgent/high priority pending tickets
 */
export async function syncSmartPinsTickets(): Promise<void> {
  // Get tickets that need attention:
  // 1. Urgent/high priority pending/in_progress tickets
  // 2. Tickets due within 7 days or overdue (and still pending/in_progress)
  const tickets = await query<{ id: string; title: string; priority: TaskPriority; status: TaskStatus; due_date: string | null }>(
    `SELECT id, title, priority, status, due_date::text
     FROM maintenance_tasks
     WHERE (status = 'pending' OR status = 'in_progress')
       AND (
         (priority = 'urgent' OR priority = 'high')
         OR (due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days')
       )`
  )

  // Get currently smart-pinned tickets
  const currentSmartPins = await query<{ entity_id: string }>(
    `SELECT entity_id FROM pinned_items WHERE entity_type = 'ticket' AND is_system_pin = true`
  )
  const currentSet = new Set(currentSmartPins.map(p => p.entity_id))

  // Pin tickets that need attention
  for (const ticket of tickets) {
    await upsertSmartPin({
      entityType: 'ticket',
      entityId: ticket.id,
      metadata: {
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        due_date: ticket.due_date,
      },
    })
    currentSet.delete(ticket.id)
  }

  // Unpin tickets that no longer need attention
  for (const ticketId of Array.from(currentSet)) {
    await removeSmartPin('ticket', ticketId)
  }
}

/**
 * Sync smart pins for BuildingLink messages based on business rules
 * Auto-pins: critical/important messages from last 7 days
 */
export async function syncSmartPinsBuildingLink(): Promise<void> {
  const vendorId = await getBuildingLinkVendorId()
  if (!vendorId) return

  // Get all messages (need more than 7 days for package tracking)
  const allMessages = await query<{ id: string; subject: string; body_snippet: string | null; received_at: string }>(
    `SELECT id, subject, body_snippet, received_at
     FROM vendor_communications
     WHERE vendor_id = $1
     ORDER BY received_at DESC
     LIMIT 500`,
    [vendorId]
  )

  // Get currently smart-pinned messages
  const currentSmartPins = await query<{ entity_id: string }>(
    `SELECT entity_id FROM pinned_items WHERE entity_type = 'buildinglink_message' AND is_system_pin = true`
  )
  const currentSet = new Set(currentSmartPins.map(p => p.entity_id))

  // Recent messages (7 days) for critical/important
  const recentMessages = allMessages.filter(m => {
    const daysAgo = (Date.now() - new Date(m.received_at).getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 7
  })

  // Pin critical/important messages
  for (const msg of recentMessages) {
    const { category } = categorizeBuildingLinkMessage(msg.subject, msg.body_snippet)

    if (category === 'critical' || category === 'important') {
      const unit = extractUnit(msg.subject, msg.body_snippet)
      await upsertSmartPin({
        entityType: 'buildinglink_message',
        entityId: msg.id,
        metadata: {
          title: msg.subject,
          unit: unit || 'unknown',
        },
      })
      currentSet.delete(msg.id)
    }
  }

  // Pin uncollected packages (last 2 weeks)
  const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)
  const allArrivals = allMessages.filter(m => {
    const { subcategory } = categorizeBuildingLinkMessage(m.subject, m.body_snippet)
    return subcategory === 'package_arrival' && new Date(m.received_at).getTime() >= twoWeeksAgo
  })
  const allPickups = allMessages.filter(m => {
    const { subcategory } = categorizeBuildingLinkMessage(m.subject, m.body_snippet)
    return subcategory === 'package_pickup'
  })

  // Build set of picked-up package numbers
  const pickedUpPackageNumbers = new Set(
    allPickups
      .map(p => extractPackageNumber(p.body_snippet))
      .filter((pn): pn is string => pn !== null && pn !== undefined)
  )

  // Pin uncollected packages
  for (const arrival of allArrivals) {
    const packageNumber = extractPackageNumber(arrival.body_snippet)
    const isCollected = packageNumber && pickedUpPackageNumbers.has(packageNumber)

    if (!isCollected) {
      const unit = extractUnit(arrival.subject, arrival.body_snippet)
      await upsertSmartPin({
        entityType: 'buildinglink_message',
        entityId: arrival.id,
        metadata: {
          title: arrival.subject,
          unit: unit || 'unknown',
          package_number: packageNumber,
        },
      })
      currentSet.delete(arrival.id)
    }
  }

  // Unpin messages that are too old or no longer important
  for (const msgId of Array.from(currentSet)) {
    await removeSmartPin('buildinglink_message', msgId)
  }
}

/**
 * Sync all smart pins (run daily via cron)
 */
export async function syncAllSmartPins(): Promise<void> {
  await Promise.all([
    syncSmartPinsBills(),
    syncSmartPinsTickets(),
    syncSmartPinsBuildingLink(),
  ])
}

// ============================================
// DASHBOARD DATA (New Unified Design)
// ============================================

/**
 * Get all pinned items formatted for the new unified dashboard display.
 * Combines smart pins and user pins, calculates urgency status, fetches notes.
 */
export async function getDashboardPinnedItems(): Promise<{
  items: DashboardPinnedItem[]
  stats: { overdueCount: number; urgentCount: number; totalCount: number }
}> {
  // Get all pinned items with their pin type
  const pinnedItems = await query<{
    id: string
    entity_type: PinnedEntityType
    entity_id: string
    is_system_pin: boolean
    metadata: Record<string, any> | null
  }>(
    `SELECT id, entity_type, entity_id, is_system_pin, metadata
     FROM pinned_items
     WHERE dismissed_at IS NULL
     ORDER BY pinned_at DESC`
  )

  if (pinnedItems.length === 0) {
    return { items: [], stats: { overdueCount: 0, urgentCount: 0, totalCount: 0 } }
  }

  // Group by entity type for efficient batch queries
  const byType: Record<PinnedEntityType, string[]> = {
    vendor: [],
    bill: [],
    insurance_policy: [],
    ticket: [],
    buildinglink_message: [],
    property_tax: [],
    insurance_premium: [],
    document: [],
  }
  const pinTypeMap = new Map<string, 'smart' | 'user'>()
  const metadataMap = new Map<string, Record<string, any> | null>()

  for (const pin of pinnedItems) {
    byType[pin.entity_type].push(pin.entity_id)
    pinTypeMap.set(`${pin.entity_type}:${pin.entity_id}`, pin.is_system_pin ? 'smart' : 'user')
    metadataMap.set(`${pin.entity_type}:${pin.entity_id}`, pin.metadata)
  }

  // Fetch entity details in parallel
  const [bills, taxes, tickets, vendors, insurancePolicies, blMessages] = await Promise.all([
    // Bills
    byType.bill.length > 0
      ? query<Bill & { property_name: string | null; vendor_name: string | null }>(
          `SELECT b.*, p.name as property_name, v.company as vendor_name
           FROM bills b
           LEFT JOIN properties p ON b.property_id = p.id
           LEFT JOIN vendors v ON b.vendor_id = v.id
           WHERE b.id = ANY($1::uuid[])`,
          [byType.bill]
        )
      : [],
    // Property taxes
    byType.property_tax.length > 0
      ? query<PropertyTax & { property_name: string }>(
          `SELECT pt.*, p.name as property_name
           FROM property_taxes pt
           JOIN properties p ON pt.property_id = p.id
           WHERE pt.id = ANY($1::uuid[])`,
          [byType.property_tax]
        )
      : [],
    // Tickets
    byType.ticket.length > 0
      ? query<MaintenanceTask & { property_name: string | null; vehicle_name: string | null }>(
          `SELECT mt.*, p.name as property_name,
            CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name
           FROM maintenance_tasks mt
           LEFT JOIN properties p ON mt.property_id = p.id
           LEFT JOIN vehicles v ON mt.vehicle_id = v.id
           WHERE mt.id = ANY($1::uuid[])`,
          [byType.ticket]
        )
      : [],
    // Vendors
    byType.vendor.length > 0
      ? query<Vendor>(
          `SELECT * FROM vendors WHERE id = ANY($1::uuid[])`,
          [byType.vendor]
        )
      : [],
    // Insurance policies (for insurance_premium pins)
    byType.insurance_premium.length > 0
      ? query<InsurancePolicy & { property_name: string | null; vehicle_name: string | null }>(
          `SELECT ip.*, p.name as property_name,
            CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name
           FROM insurance_policies ip
           LEFT JOIN properties p ON ip.property_id = p.id
           LEFT JOIN vehicles v ON ip.vehicle_id = v.id
           WHERE ip.id = ANY($1::uuid[])`,
          [byType.insurance_premium]
        )
      : [],
    // BuildingLink messages
    byType.buildinglink_message.length > 0
      ? query<VendorCommunication>(
          `SELECT * FROM vendor_communications WHERE id = ANY($1::uuid[])`,
          [byType.buildinglink_message]
        )
      : [],
  ])

  // Fetch all notes for pinned items
  const allEntityIds = pinnedItems.map(p => p.entity_id)
  const allNotes = await query<PinNote>(
    `SELECT * FROM pin_notes WHERE entity_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
    [allEntityIds]
  )
  const notesMap = new Map<string, PinNote[]>()
  for (const note of allNotes) {
    const key = note.entity_id
    if (!notesMap.has(key)) notesMap.set(key, [])
    notesMap.get(key)!.push(note)
  }

  // Helper to calculate days until/overdue and status
  const calcDaysAndStatus = (dueDate: string | null): { days: number | null; status: DashboardPinStatus } => {
    if (!dueDate) return { days: null, status: 'normal' }
    const due = new Date(dueDate)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { days: diff, status: 'overdue' }
    if (diff <= 7) return { days: diff, status: 'urgent' }
    if (diff <= 30) return { days: diff, status: 'upcoming' }
    return { days: diff, status: 'normal' }
  }

  // Build dashboard items
  const items: DashboardPinnedItem[] = []
  let overdueCount = 0
  let urgentCount = 0

  // Process bills
  for (const bill of bills) {
    const key = `bill:${bill.id}`
    const pinType = pinTypeMap.get(key) || 'user'
    const { days, status } = calcDaysAndStatus(bill.due_date)
    if (status === 'overdue') overdueCount++
    else if (status === 'urgent') urgentCount++

    items.push({
      id: bill.id,
      entityType: 'bill',
      entityId: bill.id,
      pinType,
      title: bill.description || bill.bill_type,
      subtitle: bill.property_name || bill.vendor_name || null,
      amount: Number(bill.amount),
      dueDate: bill.due_date,
      daysUntilOrOverdue: days,
      status,
      href: `/payments`,
      icon: 'bill',
      notes: notesMap.get(bill.id) || [],
      metadata: metadataMap.get(key) ?? null,
    })
  }

  // Process property taxes
  for (const tax of taxes) {
    const key = `property_tax:${tax.id}`
    const pinType = pinTypeMap.get(key) || 'user'
    const { days, status } = calcDaysAndStatus(tax.due_date)
    if (status === 'overdue') overdueCount++
    else if (status === 'urgent') urgentCount++

    items.push({
      id: tax.id,
      entityType: 'property_tax',
      entityId: tax.id,
      pinType,
      title: `Property Tax - ${tax.jurisdiction} Q${tax.installment}`,
      subtitle: tax.property_name,
      amount: Number(tax.amount),
      dueDate: tax.due_date,
      daysUntilOrOverdue: days,
      status,
      href: `/payments`,
      icon: 'tax',
      notes: notesMap.get(tax.id) || [],
      metadata: metadataMap.get(key) ?? null,
    })
  }

  // Process tickets
  for (const ticket of tickets) {
    const key = `ticket:${ticket.id}`
    const pinType = pinTypeMap.get(key) || 'user'
    const { days, status: dateStatus } = calcDaysAndStatus(ticket.due_date)
    // Tickets with urgent/high priority are always "urgent" status
    const status: DashboardPinStatus = ticket.priority === 'urgent' || ticket.priority === 'high'
      ? 'urgent'
      : dateStatus
    if (status === 'overdue') overdueCount++
    else if (status === 'urgent') urgentCount++

    items.push({
      id: ticket.id,
      entityType: 'ticket',
      entityId: ticket.id,
      pinType,
      title: ticket.title,
      subtitle: ticket.property_name || ticket.vehicle_name || null,
      amount: ticket.estimated_cost ? Number(ticket.estimated_cost) : null,
      dueDate: ticket.due_date,
      daysUntilOrOverdue: days,
      status,
      href: `/maintenance/${ticket.id}`,
      icon: 'ticket',
      notes: notesMap.get(ticket.id) || [],
      metadata: metadataMap.get(key) ?? null,
    })
  }

  // Process vendors (no due date, always normal)
  for (const vendor of vendors) {
    const key = `vendor:${vendor.id}`
    const pinType = pinTypeMap.get(key) || 'user'

    items.push({
      id: vendor.id,
      entityType: 'vendor',
      entityId: vendor.id,
      pinType,
      title: vendor.company || vendor.name,
      subtitle: vendor.name !== (vendor.company || vendor.name) ? vendor.name : null,
      amount: null,
      dueDate: null,
      daysUntilOrOverdue: null,
      status: 'normal',
      href: `/vendors/${vendor.id}`,
      icon: 'vendor',
      notes: notesMap.get(vendor.id) || [],
      metadata: metadataMap.get(key) ?? null,
    })
  }

  // Process insurance premiums
  for (const policy of insurancePolicies) {
    const key = `insurance_premium:${policy.id}`
    const pinType = pinTypeMap.get(key) || 'user'
    const { days, status } = calcDaysAndStatus(policy.expiration_date)
    if (status === 'overdue') overdueCount++
    else if (status === 'urgent') urgentCount++

    items.push({
      id: policy.id,
      entityType: 'insurance_premium',
      entityId: policy.id,
      pinType,
      title: `${policy.carrier_name} - ${policy.policy_type}`,
      subtitle: policy.property_name || policy.vehicle_name || null,
      amount: policy.premium_amount ? Number(policy.premium_amount) : null,
      dueDate: policy.expiration_date,
      daysUntilOrOverdue: days,
      status,
      href: `/insurance/${policy.id}`,
      icon: 'insurance',
      notes: notesMap.get(policy.id) || [],
      metadata: metadataMap.get(key) ?? null,
    })
  }

  // Process BuildingLink messages
  for (const msg of blMessages) {
    const key = `buildinglink_message:${msg.id}`
    const pinType = pinTypeMap.get(key) || 'user'
    // BuildingLink important messages are urgent
    const status: DashboardPinStatus = msg.is_important ? 'urgent' : 'normal'
    if (status === 'urgent') urgentCount++
    // Derive unit from subject/body
    const unit = extractUnit(msg.subject || '', msg.body_snippet)

    items.push({
      id: msg.id,
      entityType: 'buildinglink_message',
      entityId: msg.id,
      pinType,
      title: msg.subject || 'BuildingLink Message',
      subtitle: unit !== 'unknown' ? unit : null,
      amount: null,
      dueDate: null,
      daysUntilOrOverdue: null,
      status,
      href: `/buildinglink`,
      icon: 'building',
      notes: notesMap.get(msg.id) || [],
      metadata: metadataMap.get(key) ?? null,
    })
  }

  // Process documents (from metadata, no DB lookup needed)
  for (const pin of pinnedItems.filter(p => p.entity_type === 'document')) {
    const key = `document:${pin.entity_id}`
    const pinType = pinTypeMap.get(key) || 'user'
    const metadata = metadataMap.get(key) || {}

    items.push({
      id: pin.entity_id,
      entityType: 'document',
      entityId: pin.entity_id,
      pinType,
      title: metadata.title || metadata.name || 'Document',
      subtitle: metadata.path || null,
      amount: null,
      dueDate: null,
      daysUntilOrOverdue: null,
      status: 'normal',
      href: `/documents`,
      icon: 'document',
      notes: notesMap.get(pin.entity_id) || [],
      metadata,
    })
  }

  // Sort by urgency: overdue first, then urgent, then upcoming, then normal
  // Within same status, sort by days (most urgent first)
  const statusOrder: Record<DashboardPinStatus, number> = {
    overdue: 0,
    urgent: 1,
    upcoming: 2,
    normal: 3,
  }

  items.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    // Within same status, sort by days (null goes last)
    if (a.daysUntilOrOverdue === null && b.daysUntilOrOverdue === null) return 0
    if (a.daysUntilOrOverdue === null) return 1
    if (b.daysUntilOrOverdue === null) return -1
    return a.daysUntilOrOverdue - b.daysUntilOrOverdue
  })

  return {
    items,
    stats: {
      overdueCount,
      urgentCount,
      totalCount: items.length,
    },
  }
}

/**
 * Get items due in the next 7 days that are NOT already pinned.
 * For the "Coming Up" section of the dashboard.
 */
export async function getUpcomingWeek(): Promise<UpcomingItem[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  const visibleVehicleIds = await getVisibleVehicleIds()

  // Get all currently pinned entity IDs to exclude
  const pinnedBills = await getPinnedIds('bill')
  const pinnedTaxes = await getPinnedIds('property_tax')
  const pinnedTickets = await getPinnedIds('ticket')

  // Fetch bills due in 7 days (not pinned)
  const bills = await query<{ id: string; description: string; bill_type: string; amount: string; due_date: string; property_name: string | null }>(
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
  )

  // Fetch property taxes due in 7 days (not pinned)
  const taxes = await query<{ id: string; jurisdiction: string; installment: number; amount: string; due_date: string; property_name: string }>(
    `SELECT pt.id, pt.jurisdiction, pt.installment, pt.amount, pt.due_date::text, p.name as property_name
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.status = 'pending'
       AND pt.due_date >= CURRENT_DATE
       AND pt.due_date <= CURRENT_DATE + 7
       AND pt.property_id = ANY($1::uuid[])
     ORDER BY pt.due_date`,
    [ctx.visiblePropertyIds]
  )

  // Fetch insurance expirations in 7 days
  const insurance = await query<{ id: string; carrier_name: string; policy_type: string; premium_amount: string | null; expiration_date: string; property_name: string | null; vehicle_name: string | null }>(
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
  )

  // Fetch vehicle registrations/inspections expiring in 7 days
  const vehicles = await query<{ id: string; year: number; make: string; model: string; registration_expires: string | null; inspection_expires: string | null }>(
    `SELECT id, year, make, model, registration_expires::text, inspection_expires::text
     FROM vehicles
     WHERE is_active = TRUE
       AND id = ANY($1::uuid[])
       AND (
         (registration_expires >= CURRENT_DATE AND registration_expires <= CURRENT_DATE + 7)
         OR (inspection_expires >= CURRENT_DATE AND inspection_expires <= CURRENT_DATE + 7)
       )`,
    [visibleVehicleIds]
  )

  // Fetch maintenance tasks with due dates in 7 days (not pinned)
  const tasks = await query<{ id: string; title: string; due_date: string; property_name: string | null; vehicle_name: string | null }>(
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
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  return query<PropertyTax>(
    `SELECT pt.*, row_to_json(p.*) as property
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.property_id = ANY($1::uuid[])
     ORDER BY pt.due_date`,
    [ctx.visiblePropertyIds]
  )
}

export async function getUpcomingPropertyTaxes(days: number = 90): Promise<PropertyTax[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  return query<PropertyTax>(
    `SELECT pt.*, row_to_json(p.*) as property
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.status = 'pending'
       AND pt.due_date <= CURRENT_DATE + ($1::INTEGER)
       AND pt.property_id = ANY($2::uuid[])
     ORDER BY pt.due_date`,
    [days, ctx.visiblePropertyIds]
  )
}

export async function getPropertyTaxHistory(propertyId: string): Promise<PropertyTax[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || !ctx.visiblePropertyIds.includes(propertyId)) return []

  return query<PropertyTax>(
    `SELECT * FROM property_taxes
     WHERE property_id = $1
     ORDER BY tax_year DESC, installment`,
    [propertyId]
  )
}

// Insurance
export async function getInsurancePolicies(): Promise<InsurancePolicy[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  const visibleVehicleIds = await getVisibleVehicleIds()

  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE (
       (ip.property_id IS NULL AND ip.vehicle_id IS NULL) OR
       (ip.property_id IS NOT NULL AND ip.property_id = ANY($1::uuid[])) OR
       (ip.vehicle_id IS NOT NULL AND ip.vehicle_id = ANY($2::uuid[]))
     )
     ORDER BY ip.expiration_date`,
    [ctx.visiblePropertyIds, visibleVehicleIds]
  )
}

export async function getExpiringPolicies(days: number = 60): Promise<InsurancePolicy[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  const visibleVehicleIds = await getVisibleVehicleIds()

  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.expiration_date <= CURRENT_DATE + ($1::INTEGER)
       AND (
         (ip.property_id IS NULL AND ip.vehicle_id IS NULL) OR
         (ip.property_id IS NOT NULL AND ip.property_id = ANY($2::uuid[])) OR
         (ip.vehicle_id IS NOT NULL AND ip.vehicle_id = ANY($3::uuid[]))
       )
     ORDER BY ip.expiration_date`,
    [days, ctx.visiblePropertyIds, visibleVehicleIds]
  )
}

export async function getInsurancePolicy(id: string): Promise<InsurancePolicy | null> {
  const ctx = await getVisibilityContext()
  if (!ctx) return null

  const results = await query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.id = $1`,
    [id]
  )
  return results[0] || null
}

export async function getInsurancePoliciesForProperty(propertyId: string): Promise<InsurancePolicy[]> {
  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.property_id = $1
     ORDER BY ip.expiration_date`,
    [propertyId]
  )
}

export async function getInsurancePoliciesForVehicle(vehicleId: string): Promise<InsurancePolicy[]> {
  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.vehicle_id = $1
     ORDER BY ip.expiration_date`,
    [vehicleId]
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

// Tickets (enhanced maintenance tasks)
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

export async function getTickets(filters?: TicketFilters): Promise<TicketWithDetails[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  const conditions: string[] = []
  const params: (string | string[])[] = [ctx.visiblePropertyIds]
  let paramIndex = 2

  // Property must be visible (or vehicle's property must be visible, or no property/vehicle)
  conditions.push(`(
    mt.property_id = ANY($1::uuid[])
    OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($1::uuid[]))
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

export async function getTicket(id: string): Promise<TicketWithDetails | null> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return null

  return queryOne<TicketWithDetails>(
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
         OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($2::uuid[]))
         OR (mt.property_id IS NULL AND mt.vehicle_id IS NULL)
       )`,
    [id, ctx.visiblePropertyIds]
  )
}

export async function getTicketActivity(ticketId: string): Promise<TicketActivity[]> {
  return query<TicketActivity>(
    `SELECT * FROM ticket_activity WHERE ticket_id = $1 ORDER BY created_at DESC`,
    [ticketId]
  )
}

export async function getTicketsForProperty(propertyId: string, showClosed = false): Promise<TicketWithDetails[]> {
  return getTickets({ propertyId, showClosed })
}

export async function getOpenTicketCount(): Promise<number> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return 0

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM maintenance_tasks mt
     WHERE mt.status NOT IN ('completed', 'cancelled')
       AND (
         mt.property_id = ANY($1::uuid[])
         OR mt.vehicle_id IN (SELECT id FROM vehicles WHERE property_id = ANY($1::uuid[]))
         OR (mt.property_id IS NULL AND mt.vehicle_id IS NULL)
       )`,
    [ctx.visiblePropertyIds]
  )

  return parseInt(result?.count || '0', 10)
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
  | 'critical'      // Active service outages, emergencies
  | 'important'     // Building notices, service restored
  | 'maintenance'   // Maintenance requests
  | 'security'      // Key access events
  | 'package'       // Package arrivals and pickups
  | 'routine'       // Amenity updates, building events
  | 'social'        // Resident postings (hidden by default)
  | 'noise'         // Generic notifications, low value

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
  is_flagged?: boolean
  package_number?: string | null  // Extracted tracking number for package matching
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

  // ===== CRITICAL - Active service outages, weather alerts =====
  if (s.includes('out of service') || s.includes('emergency') || s.includes('urgent') || s.includes('water shut')) {
    return { category: 'critical', subcategory: 'service_outage' }
  }
  if (s.includes('weather') || s.includes('advisory') || s.includes('flood') || s.includes('storm') || s.includes('wind')) {
    return { category: 'critical', subcategory: 'weather_alert' }
  }

  // ===== PACKAGE - Arrivals and pickups (separate for smart tracking) =====
  // Check pickups FIRST (more specific)
  if (s.includes('picked up') || s.includes('has been picked up')) {
    return { category: 'package', subcategory: 'package_pickup' }
  }
  // Package arrivals
  if (s.includes('you have a') && (s.includes('package') || s.includes('delivery') || s.includes('usps') || s.includes('ups') || s.includes('fedex'))) {
    return { category: 'package', subcategory: 'package_arrival' }
  }
  if (s.startsWith('you have a') || (s.includes('delivery') && !s.includes('unclaimed'))) {
    return { category: 'package', subcategory: 'package_arrival' }
  }
  if (s.includes('excess package')) {
    return { category: 'package', subcategory: 'package_notice' }
  }

  // ===== SECURITY - Key access logs =====
  if (s.includes('key ') || s.includes('keylink')) {
    const isRemoved = s.includes('removed')
    const isReturned = s.includes('returned')
    return { category: 'security', subcategory: isRemoved ? 'key_out' : isReturned ? 'key_returned' : 'key_access' }
  }

  // ===== SOCIAL - Resident postings (hidden by default) =====
  if (s.includes('resident posting') || s.startsWith('* new resident posting') || s.includes('lost & found')) {
    return { category: 'social', subcategory: 'resident_posting' }
  }
  if (s.includes('elite staff') || s.includes('tipping')) {
    return { category: 'social', subcategory: 'social_notice' }
  }
  if (s.includes('invitation') || s.includes('celebration') || s.includes('party')) {
    return { category: 'social', subcategory: 'social_event' }
  }

  // ===== IMPORTANT - Building notices, service restored =====
  if (s.includes('back in service') || s.includes('resolved') || s.includes('reopened') || s.includes('now open')) {
    return { category: 'important', subcategory: 'service_restored' }
  }
  if (s.includes('meeting') || s.includes('vote') || s.includes('annual')) {
    return { category: 'important', subcategory: 'hoa_meeting' }
  }
  if (s.includes('common charge') || s.includes('payment') || s.includes('increase')) {
    return { category: 'important', subcategory: 'financial_notice' }
  }
  if (s.includes('notice') || s.includes('reminder:') || s.includes('policy') || s.includes('schedule')) {
    return { category: 'important', subcategory: 'building_notice' }
  }
  if (s.includes('cooling') || s.includes('heating') || s.includes('hvac') || s.includes('winteriz')) {
    return { category: 'important', subcategory: 'hvac_notice' }
  }
  if (s.includes('elevator') && (s.includes('update') || s.includes('replacement'))) {
    return { category: 'important', subcategory: 'elevator_update' }
  }

  // ===== MAINTENANCE - Request updates =====
  if (s.includes('maintenance request') || s.includes('maintenance #')) {
    return { category: 'maintenance', subcategory: 'maintenance_request' }
  }
  if (s.includes('loud work') || s.includes('construction') || s.includes('renovation')) {
    return { category: 'maintenance', subcategory: 'construction_notice' }
  }

  // ===== ROUTINE - Amenities, building updates =====
  if (s.includes('pool') || s.includes('gym') || s.includes('amenity') || s.includes('amenities') ||
      s.includes('fitness') || s.includes('steam') || s.includes('hot tub') || s.includes('lounge')) {
    return { category: 'routine', subcategory: 'amenity_update' }
  }
  if (s.includes('window cleaning') || s.includes('fire pump') || s.includes('peloton')) {
    return { category: 'routine', subcategory: 'building_update' }
  }

  // ===== NOISE - Generic notifications, dry cleaning =====
  if (s.includes('dry cleaning')) {
    return { category: 'noise', subcategory: 'dry_cleaning' }
  }
  if (s === 'notification' || s.includes('notification')) {
    // Generic "Notification" subject - check body for context
    if (b.includes('package') || b.includes('delivery') || b.includes('amazon')) {
      return { category: 'package', subcategory: 'package_arrival' }
    }
    return { category: 'noise', subcategory: 'generic_notification' }
  }

  // Default - categorize as routine
  return { category: 'routine', subcategory: 'other' }
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

// Extract package tracking number from BuildingLink message body
// Handles formats: box./1ZA9V944..., pkg./TBA326..., PKG./420112..., hw BOX./1Z..., cylinder./420...
function extractPackageNumber(bodySnippet: string | null): string | null {
  if (!bodySnippet) return null

  // Match: (box|pkg|cylinder|hw box|hw BOX|HW box) followed by delimiters (./ or .. or / or . ) then tracking number
  // The tracking number is alphanumeric, typically 12-34 characters
  const match = bodySnippet.match(/(?:box|pkg|cylinder|hw\s*box)[\.\s\/]+([A-Z0-9]{8,40})/i)

  if (match && match[1]) {
    // Normalize to uppercase for consistent matching
    return match[1].toUpperCase()
  }

  return null
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

  // Categorize each message and extract package numbers
  const categorized: BuildingLinkMessage[] = messages.map(msg => {
    const { category, subcategory } = categorizeBuildingLinkMessage(msg.subject, msg.body_snippet)
    const unit = extractUnit(msg.subject, msg.body_snippet)
    const package_number = (category === 'package') ? extractPackageNumber(msg.body_snippet) : null
    return {
      ...msg,
      category,
      subcategory,
      unit,
      package_number,
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

// Get user's flagged message IDs
export async function getBuildingLinkFlaggedIds(userId: string): Promise<Set<string>> {
  const flags = await query<{ message_id: string }>(
    `SELECT message_id FROM buildinglink_message_flags WHERE user_id = $1`,
    [userId]
  )
  return new Set(flags.map(f => f.message_id))
}

// Toggle flag on a message
export async function toggleBuildingLinkFlag(
  messageId: string,
  userId: string
): Promise<boolean> {
  // Check if already flagged
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM buildinglink_message_flags WHERE message_id = $1 AND user_id = $2`,
    [messageId, userId]
  )

  if (existing) {
    // Unflag
    await query(
      `DELETE FROM buildinglink_message_flags WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId]
    )
    return false
  } else {
    // Flag
    await query(
      `INSERT INTO buildinglink_message_flags (message_id, user_id) VALUES ($1, $2)`,
      [messageId, userId]
    )
    return true
  }
}

// Get messages enriched with flag status
export async function getBuildingLinkMessagesWithFlags(
  userId: string,
  options?: {
    category?: BuildingLinkCategory | 'all'
    limit?: number
    search?: string
    includeSocial?: boolean
  }
): Promise<BuildingLinkMessage[]> {
  const messages = await getBuildingLinkMessages({
    category: options?.category,
    limit: options?.limit || 200,
    search: options?.search,
  })

  const flaggedIds = await getBuildingLinkFlaggedIds(userId)

  // Enrich with flag status and filter social if needed
  return messages
    .map(msg => ({ ...msg, is_flagged: flaggedIds.has(msg.id) }))
    .filter(msg => options?.includeSocial || msg.category !== 'social')
}

// Get "Needs Attention" items
export interface NeedsAttentionItems {
  activeOutages: BuildingLinkMessage[]
  uncollectedPackages: BuildingLinkMessage[]
  flaggedMessages: BuildingLinkMessage[]
}

export async function getBuildingLinkNeedsAttention(): Promise<NeedsAttentionItems> {
  const messages = await getBuildingLinkMessages({ limit: 500 })

  // Get dismissed smart pins (user manually dismissed these)
  const dismissedPins = await query<{ entity_id: string }>(
    `SELECT entity_id FROM pinned_items
     WHERE entity_type = 'buildinglink_message'
       AND is_system_pin = true
       AND dismissed_at IS NOT NULL`
  )
  const dismissedIds = new Set(dismissedPins.map(p => p.entity_id))

  // Active outages: service_outage within last 7 days without matching service_restored
  const recentMessages = messages.filter(m => {
    const daysAgo = (Date.now() - new Date(m.received_at).getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 7
  })

  // Find active outages (outage without subsequent restore)
  const outages = recentMessages.filter(m => m.subcategory === 'service_outage')
  const restorations = recentMessages.filter(m => m.subcategory === 'service_restored')
  const restorationSubjects = new Set(restorations.map(r => {
    // Extract key identifier (e.g., "Elevator 2" from "Elevator 2 Back In Service")
    return r.subject.toLowerCase().replace(/back in service|resolved|reopened|now open/gi, '').trim()
  }))

  const activeOutages = outages.filter(o => {
    // If dismissed, user doesn't want to see it
    if (dismissedIds.has(o.id)) return false

    const outageKey = o.subject.toLowerCase().replace(/out of service|emergency/gi, '').trim()
    // Check if there's a matching restoration after this outage
    const hasRestoration = restorations.some(r => {
      const restoreKey = r.subject.toLowerCase().replace(/back in service|resolved|reopened|now open/gi, '').trim()
      const isSameService = restoreKey.includes(outageKey) || outageKey.includes(restoreKey)
      const isAfter = new Date(r.received_at) > new Date(o.received_at)
      return isSameService && isAfter
    })
    return !hasRestoration
  })

  // Uncollected packages: arrivals without matching pickup (matched by package number)
  // Only show packages from last 2 weeks
  const allArrivals = messages.filter(m => m.subcategory === 'package_arrival')
  const allPickups = messages.filter(m => m.subcategory === 'package_pickup')

  // Build set of picked-up package numbers
  const pickedUpPackageNumbers = new Set(
    allPickups
      .map(p => p.package_number)
      .filter((pn): pn is string => pn !== null && pn !== undefined)
  )

  // Find uncollected packages: not picked up AND not dismissed
  const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)
  const uncollectedPackages = allArrivals.filter(arrival => {
    // Skip packages older than 2 weeks (initial cleanup)
    if (new Date(arrival.received_at).getTime() < twoWeeksAgo) return false

    // If dismissed, user doesn't want to see it
    if (dismissedIds.has(arrival.id)) return false

    // If no package number could be extracted, show it (let user manually dismiss)
    if (!arrival.package_number) return true

    // Check if this package number has been picked up
    return !pickedUpPackageNumbers.has(arrival.package_number)
  })

  // User-pinned messages (important messages user manually pinned)
  const allPinnedIds = await getPinnedIds('buildinglink_message')
  const flaggedMessages = messages
    .filter(m => allPinnedIds.has(m.id) && !dismissedIds.has(m.id) && m.subcategory !== 'package_arrival' && m.subcategory !== 'service_outage')
    .map(m => ({ ...m, is_flagged: true }))

  return {
    activeOutages: activeOutages.map(m => ({ ...m, is_flagged: allPinnedIds.has(m.id) })),
    uncollectedPackages: uncollectedPackages.map(m => ({ ...m, is_flagged: allPinnedIds.has(m.id) })),
    flaggedMessages,
  }
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
  | 'pin_note'

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

  // Pin Notes with due dates - fetch actual entity data for better context
  const pinNotes = await query<{
    id: string
    entity_type: string
    entity_id: string
    note: string
    user_name: string
    due_date: string
    // Actual entity data (one will be populated based on entity_type)
    bill_description: string | null
    bill_type: string | null
    vendor_name: string | null
    property_name: string | null
    ticket_title: string | null
    tax_jurisdiction: string | null
    insurance_carrier: string | null
    pin_metadata: any | null
  }>(`
    SELECT
      pn.id,
      pn.entity_type,
      pn.entity_id,
      pn.note,
      pn.user_name,
      pn.due_date::text,
      -- Bill data
      COALESCE(b.description, b.bill_type::text) as bill_description,
      b.bill_type,
      -- Vendor data
      v.company as vendor_name,
      -- Property data (from bill or tax)
      COALESCE(bp.name, pt_prop.name) as property_name,
      -- Ticket data
      mt.title as ticket_title,
      -- Property tax data
      pt.jurisdiction as tax_jurisdiction,
      -- Insurance data (via insurance_policies or direct carrier)
      ip.carrier_name as insurance_carrier,
      -- Get metadata from pinned_items for documents and other entities
      pi.metadata as pin_metadata
    FROM pin_notes pn
    LEFT JOIN bills b ON pn.entity_type = 'bill' AND pn.entity_id = b.id
    LEFT JOIN properties bp ON b.property_id = bp.id
    LEFT JOIN vendors v ON pn.entity_type = 'vendor' AND pn.entity_id = v.id
    LEFT JOIN maintenance_tasks mt ON pn.entity_type = 'ticket' AND pn.entity_id = mt.id
    LEFT JOIN property_taxes pt ON pn.entity_type = 'property_tax' AND pn.entity_id = pt.id
    LEFT JOIN properties pt_prop ON pt.property_id = pt_prop.id
    LEFT JOIN insurance_policies ip ON pn.entity_type = 'insurance_premium' AND pn.entity_id = ip.id
    LEFT JOIN pinned_items pi ON pn.entity_type = pi.entity_type AND pn.entity_id = pi.entity_id
    WHERE pn.due_date BETWEEN $1 AND $2
    ORDER BY pn.due_date
  `, [startDate, endDate])

  for (const note of pinNotes) {
    const isOverdue = new Date(note.due_date) < new Date()

    // Extract title from actual entity data
    let title = 'Pinned Item'
    let href = null

    switch (note.entity_type) {
      case 'vendor':
        title = note.vendor_name || 'Vendor'
        href = `/vendors/${note.entity_id}`
        break
      case 'bill':
        title = note.bill_description || 'Bill'
        href = '/payments'
        break
      case 'ticket':
        title = note.ticket_title || 'Ticket'
        href = `/tickets/${note.entity_id}`
        break
      case 'insurance_policy':
        title = note.insurance_carrier ? `${note.insurance_carrier} Policy` : 'Insurance Policy'
        href = '/insurance'
        break
      case 'property_tax':
        title = note.tax_jurisdiction ? `${note.property_name || ''} ${note.tax_jurisdiction} Tax`.trim() : 'Property Tax'
        href = '/payments'
        break
      case 'insurance_premium':
        title = note.insurance_carrier ? `${note.insurance_carrier} Premium` : 'Insurance Premium'
        href = '/payments'
        break
      case 'buildinglink_message':
        title = 'BuildingLink Message'
        href = '/buildinglink'
        break
      case 'document':
        // Documents use pinned_items metadata
        title = note.pin_metadata?.title || 'Document'
        href = '/documents'
        break
    }

    events.push({
      id: `note-${note.id}`,
      type: 'pin_note',
      title: title,
      description: note.note || '',  // Full note text
      date: note.due_date,
      amount: null,
      status: null,
      propertyName: note.property_name,
      vehicleName: null,
      vendorName: note.user_name,  // Who created the note
      isOverdue,
      isUrgent: isOverdue,
      href,
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
