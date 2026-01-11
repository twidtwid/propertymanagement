/**
 * Insurance policy query functions
 *
 * Extracted from monolithic actions-remaining.ts as part of Phase 3B refactoring.
 * All insurance policy queries, filtering, and carrier lookups.
 */

"use server"

import { query } from "../db"
import { getVisibilityContext, getVisibleVehicleIds } from "../visibility"
import type { InsurancePolicy } from "@/types/database"

interface InsuranceFilters {
  type?: string
  carrier?: string
  status?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function getInsurancePolicies(): Promise<InsurancePolicy[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  const visibleVehicleIds = await getVisibleVehicleIds()

  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE (
       (ip.property_id IS NULL AND ip.vehicle_id IS NULL) OR
       (ip.property_id IS NOT NULL AND ip.property_id = ANY($1::uuid[])) OR
       (ip.vehicle_id IS NOT NULL AND ip.vehicle_id = ANY($2::uuid[]))
     )
     ORDER BY ip.expiration_date`,
    [ctx.visiblePropertyIds, visibleVehicleIds]
  )
}

export async function getExpiringPolicies(days: number = 60): Promise<InsurancePolicy[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  const visibleVehicleIds = await getVisibleVehicleIds()

  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.expiration_date <= CURRENT_DATE + ($1::INTEGER)
       AND (
         (ip.property_id IS NULL AND ip.vehicle_id IS NULL) OR
         (ip.property_id IS NOT NULL AND ip.property_id = ANY($2::uuid[])) OR
         (ip.vehicle_id IS NOT NULL AND ip.vehicle_id = ANY($3::uuid[]))
       )
     ORDER BY ip.expiration_date`,
    [days, ctx.visiblePropertyIds, visibleVehicleIds]
  )
}

export async function getInsurancePolicy(id: string): Promise<InsurancePolicy | null> {
  const ctx = await getVisibilityContext()
  if (!ctx) return null

  const results = await query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.id = $1`,
    [id]
  )
  return results[0] || null
}

export async function getInsurancePoliciesForProperty(propertyId: string): Promise<InsurancePolicy[]> {
  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.property_id = $1
     ORDER BY ip.expiration_date`,
    [propertyId]
  )
}

export async function getInsurancePoliciesForVehicle(vehicleId: string): Promise<InsurancePolicy[]> {
  return query<InsurancePolicy>(
    `SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM insurance_policies ip
     LEFT JOIN properties p ON ip.property_id = p.id
     LEFT JOIN vehicles v ON ip.vehicle_id = v.id
     WHERE ip.vehicle_id = $1
     ORDER BY ip.expiration_date`,
    [vehicleId]
  )
}

export async function getInsurancePoliciesFiltered(filters: InsuranceFilters = {}): Promise<InsurancePolicy[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  const visibleVehicleIds = await getVisibleVehicleIds()

  let sql = `
    SELECT ip.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle,
           COALESCE(p.name, CONCAT(v.year, ' ', v.make, ' ', v.model)) as asset_name
    FROM insurance_policies ip
    LEFT JOIN properties p ON ip.property_id = p.id
    LEFT JOIN vehicles v ON ip.vehicle_id = v.id
    WHERE (
      (ip.property_id IS NULL AND ip.vehicle_id IS NULL) OR
      (ip.property_id IS NOT NULL AND ip.property_id = ANY($1::uuid[])) OR
      (ip.vehicle_id IS NOT NULL AND ip.vehicle_id = ANY($2::uuid[]))
    )
  `
  const params: any[] = [ctx.visiblePropertyIds, visibleVehicleIds]
  let paramIndex = 3

  if (filters.type && filters.type !== 'all') {
    sql += ` AND ip.policy_type = $${paramIndex}`
    params.push(filters.type)
    paramIndex++
  }

  if (filters.carrier && filters.carrier !== 'all') {
    sql += ` AND ip.carrier_name = $${paramIndex}`
    params.push(filters.carrier)
    paramIndex++
  }

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'active') {
      sql += ` AND ip.expiration_date >= CURRENT_DATE`
    } else if (filters.status === 'expiring') {
      sql += ` AND ip.expiration_date >= CURRENT_DATE AND ip.expiration_date <= CURRENT_DATE + 60`
    } else if (filters.status === 'expired') {
      sql += ` AND ip.expiration_date < CURRENT_DATE`
    }
  }

  if (filters.search) {
    sql += ` AND (
      ip.carrier_name ILIKE $${paramIndex} OR
      ip.policy_number ILIKE $${paramIndex} OR
      p.name ILIKE $${paramIndex} OR
      CONCAT(v.year, ' ', v.make, ' ', v.model) ILIKE $${paramIndex}
    )`
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  // Sorting
  const sortColumn = filters.sortBy || 'expiration_date'
  const sortOrder = filters.sortOrder || 'asc'
  const validColumns = ['carrier_name', 'policy_type', 'premium_amount', 'expiration_date', 'asset_name']
  const column = validColumns.includes(sortColumn) ? sortColumn : 'expiration_date'

  sql += ` ORDER BY ${column} ${sortOrder === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`

  return query<InsurancePolicy>(sql, params)
}

export async function getInsuranceCarriers(): Promise<string[]> {
  const ctx = await getVisibilityContext()
  if (!ctx) return []

  const visibleVehicleIds = await getVisibleVehicleIds()

  const result = await query<{ carrier_name: string }>(
    `SELECT DISTINCT carrier_name
     FROM insurance_policies ip
     WHERE (
       (ip.property_id IS NULL AND ip.vehicle_id IS NULL) OR
       (ip.property_id IS NOT NULL AND ip.property_id = ANY($1::uuid[])) OR
       (ip.vehicle_id IS NOT NULL AND ip.vehicle_id = ANY($2::uuid[]))
     )
     ORDER BY carrier_name`,
    [ctx.visiblePropertyIds, visibleVehicleIds]
  )
  return result.map(r => r.carrier_name)
}
