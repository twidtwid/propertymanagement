"use server"

import { query, queryOne } from "../db"
import { getPinnedIds } from "./pinning"

// ============================================================================
// Type Definitions
// ============================================================================

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

export interface NeedsAttentionItems {
  activeOutages: BuildingLinkMessage[]
  uncollectedPackages: BuildingLinkMessage[]
  flaggedMessages: BuildingLinkMessage[]
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

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

// ============================================================================
// Public Query Functions
// ============================================================================

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
    sinceDate?: string  // ISO date string to filter messages from this date onwards
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

  // Filter by date if specified (for performance on dashboard)
  if (options?.sinceDate) {
    sql += ` AND received_at >= $${paramIndex}::date`
    params.push(options.sinceDate)
    paramIndex++
  }

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
export async function getBuildingLinkNeedsAttention(): Promise<NeedsAttentionItems> {
  // Only fetch messages from last 14 days (packages) - outages only need 7 days
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const sinceDate = fourteenDaysAgo.toISOString().split('T')[0]

  const messages = await getBuildingLinkMessages({
    limit: 150,  // Reduced from 500 - we only need recent messages
    sinceDate,
  })

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
  // Exclude resolved items (service_restored, package_pickup, package_arrival, service_outage)
  const allPinnedIds = await getPinnedIds('buildinglink_message')
  const flaggedMessages = messages
    .filter(m =>
      allPinnedIds.has(m.id) &&
      !dismissedIds.has(m.id) &&
      m.subcategory !== 'package_arrival' &&
      m.subcategory !== 'package_pickup' &&
      m.subcategory !== 'service_outage' &&
      m.subcategory !== 'service_restored'
    )
    .map(m => ({ ...m, is_flagged: true }))

  return {
    activeOutages: activeOutages.map(m => ({ ...m, is_flagged: allPinnedIds.has(m.id) })),
    uncollectedPackages: uncollectedPackages.map(m => ({ ...m, is_flagged: allPinnedIds.has(m.id) })),
    flaggedMessages,
  }
}
