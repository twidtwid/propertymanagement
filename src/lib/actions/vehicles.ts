/**
 * Vehicle-related query functions
 *
 * Extracted from monolithic actions.ts as part of Phase 3 refactoring.
 * All basic vehicle CRUD operations and queries.
 */

"use server"

import { query, queryOne } from "../db"
import { getVisibleVehicleIds } from "../visibility"
import type { Vehicle } from "@/types/database"

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
