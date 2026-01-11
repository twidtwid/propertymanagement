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
import { getPinnedIds } from "./actions/pinning"

// Re-export from payments
import { getUpcomingAutopays as _getUpcomingAutopays, type UpcomingAutopay } from "@/lib/payments/email-links"

// ============================================================================
// Functions
// ============================================================================

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




// Payments - migrated to src/lib/actions/payments.ts

/**
 * Get linked emails for multiple payments (batch)
 */

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
