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
  VendorSpecialty,
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
  PropertyAccess,
  TrustedNeighbor,
  PropertyRenewal,
} from "@/types/database"
import type { VendorWithLocations, VendorCommunication } from "./actions/vendors"

// Re-export from payments
import { getUpcomingAutopays as _getUpcomingAutopays, type UpcomingAutopay } from "@/lib/payments/email-links"

export async function getUpcomingAutopays(
  daysBack: number = 7,
  limit: number = 10
): Promise<UpcomingAutopay[]> {
  return _getUpcomingAutopays(daysBack, limit)
}

// Properties - migrated to src/lib/actions/properties.ts

// Vehicles - migrated to src/lib/actions/vehicles.ts

// Bills - migrated to src/lib/actions/bills.ts (further down in file)

// Vendors - migrated to src/lib/actions/vendors.ts

// Equipment - TODO: Extract to equipment domain

// ============================================
// Property Renewals
// ============================================

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

// Get weather conditions for dashboard SSR (avoids client-side fetch)
export async function getWeatherConditions() {
  try {
    const { fetchAllWeather } = await import('@/lib/weather')
    return fetchAllWeather()
  } catch (error) {
    console.error('Failed to fetch weather conditions:', error)
    return []
  }
}
