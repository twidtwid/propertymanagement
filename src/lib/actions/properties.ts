/**
 * Property-related query functions
 *
 * Extracted from monolithic actions.ts as part of Phase 3 refactoring.
 * All basic property CRUD operations and queries.
 */

"use server"

import { query, queryOne } from "../db"
import { getVisibilityContext } from "../visibility"
import type { Property } from "@/types/database"

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
