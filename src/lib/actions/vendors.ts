/**
 * Vendor-related query functions
 *
 * Extracted from monolithic actions-remaining.ts as part of Phase 3B refactoring.
 * All vendor CRUD operations, contacts, communications, and location queries.
 */

"use server"

import { query, queryOne } from "../db"
import { getVisibilityContext, getVisibleVendorIds } from "../visibility"
import type { Vendor, VendorContact, Property, VendorSpecialty } from "@/types/database"

// Vendor with associated properties for location display
export interface VendorWithLocations extends Vendor {
  locations: string[]
}

export interface VendorFilters {
  specialty?: string
  location?: string
  search?: string
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
    result = result.filter(v => v.specialties.includes(filters.specialty as VendorSpecialty))
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

/**
 * Get vendors by specific IDs - optimized for dashboard pinned vendors.
 * Skips the full visibility check since we already have the pinned IDs.
 */
export async function getVendorsByIds(ids: string[]): Promise<VendorWithLocations[]> {
  if (ids.length === 0) return []

  const ctx = await getVisibilityContext()
  if (!ctx) return []

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
    WHERE v.id = ANY($1::uuid[]) AND v.is_active = TRUE
    GROUP BY v.id
    ORDER BY COALESCE(v.company, v.name)
  `, [ids, ctx.visiblePropertyIds])

  return vendors.map(v => ({
    ...v,
    locations: v.property_locations ? v.property_locations.split(', ').filter(Boolean) : []
  }))
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

export async function getVendorCommunications(vendorId: string): Promise<VendorCommunication[]> {
  return query<VendorCommunication>(
    `SELECT * FROM vendor_communications
     WHERE vendor_id = $1
     ORDER BY received_at DESC`,
    [vendorId]
  )
}

export async function getEmailById(emailId: string): Promise<VendorCommunication | null> {
  const results = await query<VendorCommunication>(
    `SELECT * FROM vendor_communications WHERE id = $1`,
    [emailId]
  )
  return results[0] || null
}
