"use server"

import { query } from "../db"
import { getVisibilityContext } from "../visibility"
import type { PropertyAccess, TrustedNeighbor, PropertyRenewal } from "@/types/database"

// ============================================================================
// Property Access Functions
// ============================================================================

export async function getPropertyAccess(propertyId: string): Promise<PropertyAccess[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || !ctx.visiblePropertyIds.includes(propertyId)) return []

  return query<PropertyAccess>(
    `SELECT * FROM property_access
     WHERE property_id = $1 AND is_active = TRUE
     ORDER BY access_type, description`,
    [propertyId]
  )
}

// ============================================================================
// Trusted Neighbors
// ============================================================================

export async function getTrustedNeighbors(propertyId: string): Promise<TrustedNeighbor[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || !ctx.visiblePropertyIds.includes(propertyId)) return []

  return query<TrustedNeighbor>(
    `SELECT * FROM trusted_neighbors
     WHERE property_id = $1 AND is_active = TRUE
     ORDER BY name`,
    [propertyId]
  )
}

// ============================================================================
// Property Renewals
// ============================================================================

export async function getPropertyRenewals(propertyId: string): Promise<PropertyRenewal[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || !ctx.visiblePropertyIds.includes(propertyId)) return []

  return query<PropertyRenewal>(
    `SELECT pr.*, v.name as vendor_name, v.company as vendor_company
     FROM property_renewals pr
     LEFT JOIN vendors v ON pr.vendor_id = v.id
     WHERE pr.property_id = $1 AND pr.is_active = TRUE
     ORDER BY pr.due_date`,
    [propertyId]
  )
}

// Get upcoming renewals across all properties (for dashboard)
export async function getUpcomingRenewals(daysAhead: number = 90): Promise<(PropertyRenewal & { property_name: string })[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  return query<PropertyRenewal & { property_name: string }>(
    `SELECT pr.*, p.name as property_name, v.name as vendor_name, v.company as vendor_company
     FROM property_renewals pr
     JOIN properties p ON pr.property_id = p.id
     LEFT JOIN vendors v ON pr.vendor_id = v.id
     WHERE pr.property_id = ANY($1::uuid[])
       AND pr.is_active = TRUE
       AND pr.due_date <= CURRENT_DATE + ($2::INTEGER)
       AND pr.due_date >= CURRENT_DATE - 30
     ORDER BY pr.due_date`,
    [ctx.visiblePropertyIds, daysAhead]
  )
}
