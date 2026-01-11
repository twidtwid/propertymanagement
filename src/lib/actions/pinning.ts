/**
 * Unified pinning system query functions
 *
 * Extracted from monolithic actions-remaining.ts as part of Phase 3C refactoring.
 * Manages smart pins (system-generated) and user pins (manual) across all entity types.
 */

"use server"

import { query, queryOne } from "../db"
import type {
  Bill,
  PropertyTax,
  InsurancePolicy,
  MaintenanceTask,
  PinnedEntityType,
  PinNote,
  PaymentStatus,
  TaskPriority,
  TaskStatus,
  DashboardPinnedItem,
  DashboardPinStatus,
} from "@/types/database"
import type { VendorWithLocations, VendorCommunication } from "./vendors"

// ============================================================================
// PIN QUERIES
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
 * Batch fetch user pin notes for multiple entities (avoids N+1 queries)
 */
export async function getUserPinNotesByEntities(
  entityType: PinnedEntityType,
  entityIds: string[],
  userId: string
): Promise<Map<string, PinNote>> {
  if (entityIds.length === 0) return new Map()

  const notes = await query<PinNote>(
    `SELECT * FROM pin_notes
     WHERE entity_type = $1 AND entity_id = ANY($2::uuid[]) AND user_id = $3`,
    [entityType, entityIds, userId]
  )

  const notesByEntity = new Map<string, PinNote>()
  for (const note of notes) {
    notesByEntity.set(note.entity_id, note)
  }

  return notesByEntity
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

// ============================================================================
// SMART PIN SYNC FUNCTIONS
// ============================================================================

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

// BuildingLink helper types
type BuildingLinkCategory = 'critical' | 'important' | 'package' | 'routine'

// Helper functions for BuildingLink categorization (private, not exported)
function categorizeBuildingLinkMessage(subject: string, body: string | null): { category: BuildingLinkCategory; subcategory: string } {
  const subjectLower = subject.toLowerCase()
  const bodyLower = body?.toLowerCase() || ''

  // Critical: Outages, emergencies, safety issues
  if (
    subjectLower.includes('out of service') ||
    subjectLower.includes('emergency') ||
    subjectLower.includes('outage') ||
    subjectLower.includes('water shut off') ||
    subjectLower.includes('gas shut off') ||
    subjectLower.includes('no hot water') ||
    subjectLower.includes('elevator out')
  ) {
    // Check if it's a restoration message
    if (
      subjectLower.includes('back in service') ||
      subjectLower.includes('restored') ||
      subjectLower.includes('resolved') ||
      subjectLower.includes('reopened') ||
      subjectLower.includes('now open')
    ) {
      return { category: 'important', subcategory: 'service_restored' }
    }
    return { category: 'critical', subcategory: 'service_outage' }
  }

  // Packages
  if (
    subjectLower.includes('package') ||
    subjectLower.includes('delivery') ||
    subjectLower.includes('fedex') ||
    subjectLower.includes('ups') ||
    subjectLower.includes('usps')
  ) {
    if (subjectLower.includes('picked up') || subjectLower.includes('collected')) {
      return { category: 'package', subcategory: 'package_pickup' }
    }
    return { category: 'package', subcategory: 'package_arrival' }
  }

  // Important: Inspections, maintenance windows, building-wide
  if (
    subjectLower.includes('inspection') ||
    subjectLower.includes('maintenance window') ||
    subjectLower.includes('work will be performed') ||
    subjectLower.includes('building-wide') ||
    subjectLower.includes('all residents')
  ) {
    return { category: 'important', subcategory: 'maintenance_notice' }
  }

  // Default: Routine
  return { category: 'routine', subcategory: 'general' }
}

function extractUnit(subject: string, body: string | null): 'PH2E' | 'PH2F' | 'both' | 'unknown' {
  const text = (subject + ' ' + (body || '')).toLowerCase()
  const hasPH2E = text.includes('ph2e') || text.includes('ph-2e') || text.includes('penthouse 2e')
  const hasPH2F = text.includes('ph2f') || text.includes('ph-2f') || text.includes('penthouse 2f')

  if (hasPH2E && hasPH2F) return 'both'
  if (hasPH2E) return 'PH2E'
  if (hasPH2F) return 'PH2F'
  return 'unknown'
}

async function getBuildingLinkVendorId(): Promise<string | null> {
  const vendor = await queryOne<{ id: string }>(
    `SELECT id FROM vendors WHERE company ILIKE '%BuildingLink%' OR name ILIKE '%BuildingLink%' LIMIT 1`
  )
  return vendor?.id || null
}

/**
 * Sync smart pins for BuildingLink messages based on business rules
 * Auto-pins: critical/important messages from last 7 days
 */
export async function syncSmartPinsBuildingLink(): Promise<void> {
  const vendorId = await getBuildingLinkVendorId()
  if (!vendorId) return

  // Get recent messages for critical/important detection
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

  // Categorize all messages to find outages and restorations
  const categorizedMessages = recentMessages.map(m => ({
    ...m,
    ...categorizeBuildingLinkMessage(m.subject, m.body_snippet)
  }))

  // Group service messages by equipment/service to find latest status
  const serviceMessages = categorizedMessages.filter(m =>
    m.subcategory === 'service_outage' || m.subcategory === 'service_restored'
  )

  // Extract service identifier (e.g., "elevator 2" from subject)
  // Normalize inconsistent naming (e.g., "North Tower Elevator" vs "Elevator 2 - North Tower")
  const getServiceKey = (subject: string): string => {
    let normalized = subject
      .toLowerCase()
      .replace(/out of service|back in service|resolved|reopened|now open|emergency|inspection/gi, '')
      .replace(/[-–—]/g, ' ') // Replace dashes with spaces
      .trim()
      .replace(/\s+/g, ' ')

    // Extract elevator number if present (e.g., "elevator 2", "elevator a")
    const elevatorMatch = normalized.match(/elevator\s+(\d+|[a-z])/i)
    if (elevatorMatch) {
      return `elevator ${elevatorMatch[1]}`
    }

    // Extract tower + elevator if no number (e.g., "north tower elevator")
    const towerMatch = normalized.match(/(north|south|east|west)\s+tower\s+elevator/i)
    if (towerMatch) {
      return `${towerMatch[1]} tower elevator`
    }

    // Fallback: return normalized string
    return normalized
  }

  // Group by service and find most recent message for each
  const serviceGroups = new Map<string, typeof categorizedMessages[0]>()
  for (const msg of serviceMessages) {
    const key = getServiceKey(msg.subject)
    const existing = serviceGroups.get(key)
    if (!existing || new Date(msg.received_at) > new Date(existing.received_at)) {
      serviceGroups.set(key, msg)
    }
  }

  // Collect IDs of outages that have been resolved (latest message is restoration)
  const resolvedOutageKeys = new Set<string>()
  for (const [key, latestMsg] of Array.from(serviceGroups.entries())) {
    if (latestMsg.subcategory === 'service_restored') {
      resolvedOutageKeys.add(key)
    }
  }

  // Pin critical/important messages (but exclude resolved outages and packages)
  for (const msg of categorizedMessages) {
    // Skip packages (handled separately in Uncollected Packages section)
    if (msg.category === 'package') continue

    // Skip service restorations (they shouldn't be pinned)
    if (msg.subcategory === 'service_restored') continue

    // For service outages, check if latest status is resolved
    if (msg.subcategory === 'service_outage') {
      const serviceKey = getServiceKey(msg.subject)
      if (resolvedOutageKeys.has(serviceKey)) continue
    }

    // Pin if critical or important
    if (msg.category === 'critical' || msg.category === 'important') {
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

  // Note: Packages are NOT smart-pinned. They have their own dedicated
  // "Uncollected Packages" section via getBuildingLinkNeedsAttention()

  // Unpin messages that are too old or no longer important
  for (const msgId of Array.from(currentSet)) {
    await removeSmartPin('buildinglink_message', msgId)
  }
}

/**
 * Sync smart pins for weather alerts
 * Auto-pins: moderate/severe/extreme weather alerts affecting properties
 */
export async function syncSmartPinsWeather(): Promise<void> {
  // Get active weather alerts with property info
  const alerts = await query<{
    id: string
    event_type: string
    headline: string
    severity: string
    expires_at: string
    property_names: string[]
  }>(`
    SELECT
      wa.id,
      wa.event_type,
      wa.headline,
      wa.severity,
      wa.expires_at::text,
      ARRAY_AGG(DISTINCT p.name) as property_names
    FROM weather_alerts wa
    JOIN property_weather_alerts pwa ON wa.id = pwa.weather_alert_id
    JOIN properties p ON pwa.property_id = p.id
    WHERE wa.expires_at > NOW()
      AND wa.severity IN ('moderate', 'severe', 'extreme')
    GROUP BY wa.id
  `)

  // Get currently smart-pinned weather alerts
  const currentSmartPins = await query<{ entity_id: string }>(
    `SELECT entity_id FROM pinned_items WHERE entity_type = 'weather_alert' AND is_system_pin = true`
  )
  const currentSet = new Set(currentSmartPins.map(p => p.entity_id))

  // Pin active alerts
  for (const alert of alerts) {
    await upsertSmartPin({
      entityType: 'weather_alert',
      entityId: alert.id,
      metadata: {
        title: alert.event_type,
        headline: alert.headline,
        severity: alert.severity,
        expires_at: alert.expires_at,
        property_names: alert.property_names,
      },
    })
    currentSet.delete(alert.id)
  }

  // Unpin expired or resolved alerts
  for (const alertId of Array.from(currentSet)) {
    await removeSmartPin('weather_alert', alertId)
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
    syncSmartPinsWeather(),
  ])
}

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
    weather_alert: [],
  }
  const pinTypeMap = new Map<string, 'smart' | 'user'>()
  const metadataMap = new Map<string, Record<string, any> | null>()

  for (const pin of pinnedItems) {
    byType[pin.entity_type].push(pin.entity_id)
    pinTypeMap.set(`${pin.entity_type}:${pin.entity_id}`, pin.is_system_pin ? 'smart' : 'user')
    metadataMap.set(`${pin.entity_type}:${pin.entity_id}`, pin.metadata)
  }

  // Fetch entity details in parallel
  const [bills, taxes, tickets, vendors, insurancePolicies, blMessages, weatherAlerts] = await Promise.all([
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
    // Tickets - exclude closed/cancelled
    byType.ticket.length > 0
      ? query<MaintenanceTask & { property_name: string | null; vehicle_name: string | null }>(
          `SELECT mt.*, p.name as property_name,
            CASE WHEN v.id IS NOT NULL THEN v.year || ' ' || v.make || ' ' || v.model ELSE NULL END as vehicle_name
           FROM maintenance_tasks mt
           LEFT JOIN properties p ON mt.property_id = p.id
           LEFT JOIN vehicles v ON mt.vehicle_id = v.id
           WHERE mt.id = ANY($1::uuid[])
             AND mt.status NOT IN ('completed', 'cancelled')`,
          [byType.ticket]
        )
      : [],
    // Vendors
    byType.vendor.length > 0
      ? query<{ id: string; company: string | null; name: string }>(
          `SELECT id, company, name FROM vendors WHERE id = ANY($1::uuid[])`,
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
    // Weather alerts
    byType.weather_alert.length > 0
      ? query<{
          id: string
          event_type: string
          headline: string
          severity: string
          expires_at: string
          provider: string
          property_names: string[]
        }>(
          `SELECT wa.id, wa.event_type, wa.headline, wa.severity, wa.expires_at::text, wa.provider,
                  ARRAY_AGG(DISTINCT p.name) as property_names
           FROM weather_alerts wa
           LEFT JOIN property_weather_alerts pwa ON wa.id = pwa.weather_alert_id
           LEFT JOIN properties p ON pwa.property_id = p.id
           WHERE wa.id = ANY($1::uuid[])
           GROUP BY wa.id`,
          [byType.weather_alert]
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
      href: `/payments/taxes`,
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
      href: `/tickets/${ticket.id}`,
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

    // Categorize message to check subcategory
    const { subcategory } = categorizeBuildingLinkMessage(msg.subject || '', msg.body_snippet)

    // Skip resolved/status messages (they don't need dashboard attention)
    if (subcategory === 'service_restored' ||
        subcategory === 'package_pickup' ||
        subcategory === 'package_arrival') {
      continue
    }

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
      icon: 'buildinglink',
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

  // Process weather alerts
  for (const alert of weatherAlerts) {
    const key = `weather_alert:${alert.id}`
    const pinType = pinTypeMap.get(key) || 'smart'

    // Weather alerts are always urgent (severe) or normal (moderate)
    const status: DashboardPinStatus = ['severe', 'extreme'].includes(alert.severity) ? 'urgent' : 'upcoming'
    if (status === 'urgent') urgentCount++

    // Get emoji based on event type
    const eventLower = alert.event_type.toLowerCase()
    let emoji = '⚠️'
    if (eventLower.includes('winter') || eventLower.includes('snow') || eventLower.includes('ice') || eventLower.includes('blizzard')) emoji = '❄️'
    else if (eventLower.includes('flood')) emoji = '🌊'
    else if (eventLower.includes('wind') || eventLower.includes('tornado')) emoji = '💨'
    else if (eventLower.includes('hurricane') || eventLower.includes('tropical')) emoji = '🌀'
    else if (eventLower.includes('heat')) emoji = '🌡️'
    else if (eventLower.includes('thunder') || eventLower.includes('storm')) emoji = '⛈️'

    const propertyStr = alert.property_names?.length > 0
      ? alert.property_names.filter(Boolean).join(', ')
      : null

    items.push({
      id: alert.id,
      entityType: 'weather_alert',
      entityId: alert.id,
      pinType,
      title: `${emoji} ${alert.event_type}`,
      subtitle: propertyStr,
      amount: null,
      dueDate: alert.expires_at,
      daysUntilOrOverdue: null, // Weather alerts use expires_at differently
      status,
      href: `/`,
      icon: 'building', // Will be overridden by title emoji
      notes: notesMap.get(alert.id) || [],
      metadata: metadataMap.get(key) ?? null,
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
