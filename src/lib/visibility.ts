"use server"

import { query } from "./db"
import { getUser } from "./auth"

/**
 * Property Visibility System
 *
 * Implements per-property visibility restrictions using a whitelist model:
 * - If a property has rows in property_visibility, ONLY those users can see it
 * - If a property has NO rows, all owners can see it (default behavior)
 *
 * Cascade logic:
 * - Vehicles inherit visibility from their linked property (via property_id)
 * - Vendors are visible if they serve at least one visible property
 * - Insurance policies inherit from their linked property/vehicle
 */

export interface VisibilityContext {
  userId: string
  isOwner: boolean
  visiblePropertyIds: string[]
  allPropertyIds: string[]
}

/**
 * Get the visibility context for the current user.
 * Returns list of property IDs the user can access.
 */
export async function getVisibilityContext(): Promise<VisibilityContext | null> {
  const user = await getUser()
  if (!user) return null

  // Get all active property IDs for comparison
  const allProps = await query<{ id: string }>(
    "SELECT id FROM properties WHERE status = 'active'"
  )
  const allPropertyIds = allProps.map((p) => p.id)

  // Bookkeepers see all properties in dropdowns (data filtering happens elsewhere)
  if (user.role === "bookkeeper") {
    return {
      userId: user.id,
      isOwner: false,
      visiblePropertyIds: allPropertyIds,
      allPropertyIds,
    }
  }

  // For owners, get visible property IDs
  // A property is visible if:
  //   1. It has NO visibility restrictions (no rows in property_visibility), OR
  //   2. The user is explicitly listed in property_visibility
  const visibleProps = await query<{ id: string }>(
    `
    SELECT p.id
    FROM properties p
    WHERE p.status = 'active'
      AND (
        NOT EXISTS (SELECT 1 FROM property_visibility pv WHERE pv.property_id = p.id)
        OR EXISTS (SELECT 1 FROM property_visibility pv WHERE pv.property_id = p.id AND pv.user_id = $1)
      )
    `,
    [user.id]
  )

  return {
    userId: user.id,
    isOwner: true,
    visiblePropertyIds: visibleProps.map((p) => p.id),
    allPropertyIds,
  }
}

/**
 * Check if a specific property is visible to the current user.
 */
export async function canAccessProperty(propertyId: string): Promise<boolean> {
  const ctx = await getVisibilityContext()
  if (!ctx) return false
  return ctx.visiblePropertyIds.includes(propertyId)
}

/**
 * Check if any of the given property IDs are visible to the current user.
 * Useful for checking vendor visibility (vendor serves any visible property).
 */
export async function canAccessAnyProperty(
  propertyIds: string[]
): Promise<boolean> {
  const ctx = await getVisibilityContext()
  if (!ctx) return false
  return propertyIds.some((id) => ctx.visiblePropertyIds.includes(id))
}

/**
 * Get list of visible vehicle IDs for the current user.
 * Vehicles are visible if:
 * - They have no property_id (not linked to any property), OR
 * - Their linked property is visible to the user
 */
export async function getVisibleVehicleIds(): Promise<string[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  // For bookkeepers, return all active vehicles
  if (!ctx.isOwner) {
    const vehicles = await query<{ id: string }>(
      "SELECT id FROM vehicles WHERE is_active = TRUE"
    )
    return vehicles.map((v) => v.id)
  }

  const vehicles = await query<{ id: string }>(
    `
    SELECT v.id
    FROM vehicles v
    WHERE v.is_active = TRUE
      AND (
        v.property_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM property_visibility pv WHERE pv.property_id = v.property_id)
        OR EXISTS (SELECT 1 FROM property_visibility pv WHERE pv.property_id = v.property_id AND pv.user_id = $1)
      )
    `,
    [ctx.userId]
  )
  return vehicles.map((v) => v.id)
}

/**
 * Get list of visible vendor IDs for the current user.
 * A vendor is visible if:
 * - They have no property associations (not linked to any property), OR
 * - They serve at least one property that is visible to the user
 */
export async function getVisibleVendorIds(): Promise<string[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  // For bookkeepers, return all active vendors
  if (!ctx.isOwner) {
    const vendors = await query<{ id: string }>(
      "SELECT id FROM vendors WHERE is_active = TRUE"
    )
    return vendors.map((v) => v.id)
  }

  const vendors = await query<{ id: string }>(
    `
    SELECT DISTINCT v.id
    FROM vendors v
    WHERE v.is_active = TRUE
      AND (
        -- Vendors with no property associations are visible to all
        NOT EXISTS (SELECT 1 FROM property_vendors pv WHERE pv.vendor_id = v.id)
        OR
        -- Vendors serving at least one visible property
        EXISTS (
          SELECT 1 FROM property_vendors pv
          JOIN properties p ON pv.property_id = p.id
          WHERE pv.vendor_id = v.id
            AND (
              NOT EXISTS (SELECT 1 FROM property_visibility vis WHERE vis.property_id = p.id)
              OR EXISTS (SELECT 1 FROM property_visibility vis WHERE vis.property_id = p.id AND vis.user_id = $1)
            )
        )
      )
    `,
    [ctx.userId]
  )
  return vendors.map((v) => v.id)
}

/**
 * Check if user can access a specific vehicle.
 */
export async function canAccessVehicle(vehicleId: string): Promise<boolean> {
  const visibleIds = await getVisibleVehicleIds()
  return visibleIds.includes(vehicleId)
}

/**
 * Check if user can access a specific vendor.
 */
export async function canAccessVendor(vendorId: string): Promise<boolean> {
  const visibleIds = await getVisibleVendorIds()
  return visibleIds.includes(vendorId)
}

/**
 * Get owners who have access to a specific property.
 * Returns empty array if property has no restrictions (all owners can see it).
 */
export async function getPropertyVisibleUsers(
  propertyId: string
): Promise<{ id: string; email: string; full_name: string | null }[]> {
  const users = await query<{ id: string; email: string; full_name: string | null }>(
    `
    SELECT p.id, p.email, p.full_name
    FROM profiles p
    JOIN property_visibility pv ON p.id = pv.user_id
    WHERE pv.property_id = $1
    ORDER BY p.full_name
    `,
    [propertyId]
  )
  return users
}

/**
 * Check if a property has visibility restrictions.
 */
export async function hasVisibilityRestrictions(
  propertyId: string
): Promise<boolean> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM property_visibility WHERE property_id = $1",
    [propertyId]
  )
  return parseInt(result[0]?.count || "0", 10) > 0
}

/**
 * Set visibility restrictions for a property.
 * Pass empty array to remove all restrictions (make visible to all owners).
 */
export async function setPropertyVisibility(
  propertyId: string,
  userIds: string[]
): Promise<void> {
  // Remove existing visibility settings
  await query("DELETE FROM property_visibility WHERE property_id = $1", [
    propertyId,
  ])

  // Add new visibility settings
  if (userIds.length > 0) {
    const values = userIds
      .map((_, i) => `($1, $${i + 2})`)
      .join(", ")
    await query(
      `INSERT INTO property_visibility (property_id, user_id) VALUES ${values}`,
      [propertyId, ...userIds]
    )
  }
}

/**
 * Get all owners (for visibility UI).
 */
export async function getOwners(): Promise<
  { id: string; email: string; full_name: string | null }[]
> {
  return query<{ id: string; email: string; full_name: string | null }>(
    "SELECT id, email, full_name FROM profiles WHERE role = 'owner' ORDER BY full_name"
  )
}
