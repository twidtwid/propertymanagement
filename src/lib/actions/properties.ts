/**
 * Property-related query functions
 *
 * Extracted from monolithic actions.ts as part of Phase 3 refactoring.
 * All basic property CRUD operations and queries.
 */

"use server"

import { query, queryOne } from "../db"
import { getVisibilityContext } from "../visibility"
import type { Property, PropertyVendor, Vendor } from "@/types/database"

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

// ============================================================================
// Property Vendors
// ============================================================================

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
       AND (pv.specialty_override = $2 OR $2 = ANY(v.specialties))
       AND v.is_active = TRUE
     ORDER BY pv.is_primary DESC
     LIMIT 1`,
    [propertyId, specialty]
  )
}
