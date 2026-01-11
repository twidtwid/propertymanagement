/**
 * Property tax query functions
 *
 * Extracted from monolithic actions-remaining.ts as part of Phase 3B refactoring.
 * All property tax queries, filtering, and jurisdiction lookups.
 */

"use server"

import { query } from "../db"
import { getVisibilityContext } from "../visibility"
import type { PropertyTax } from "@/types/database"

interface TaxFilters {
  propertyId?: string
  jurisdiction?: string
  year?: string
  status?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function getPropertyTaxes(): Promise<PropertyTax[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  return query<PropertyTax>(
    `SELECT pt.*, row_to_json(p.*) as property
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.property_id = ANY($1::uuid[])
     ORDER BY pt.tax_year DESC, pt.due_date DESC`,
    [ctx.visiblePropertyIds]
  )
}

export async function getPropertyTaxesFiltered(filters: TaxFilters = {}): Promise<(PropertyTax & { property_name: string })[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  let sql = `
    SELECT pt.*, row_to_json(p.*) as property, p.name as property_name
    FROM property_taxes pt
    JOIN properties p ON pt.property_id = p.id
    WHERE pt.property_id = ANY($1::uuid[])
  `
  const params: any[] = [ctx.visiblePropertyIds]
  let paramIndex = 2

  if (filters.propertyId && filters.propertyId !== 'all') {
    sql += ` AND pt.property_id = $${paramIndex}`
    params.push(filters.propertyId)
    paramIndex++
  }

  if (filters.jurisdiction && filters.jurisdiction !== 'all') {
    sql += ` AND pt.jurisdiction = $${paramIndex}`
    params.push(filters.jurisdiction)
    paramIndex++
  }

  if (filters.year && filters.year !== 'all') {
    sql += ` AND pt.tax_year = $${paramIndex}::INTEGER`
    params.push(filters.year)
    paramIndex++
  }

  if (filters.status && filters.status !== 'all') {
    sql += ` AND pt.status = $${paramIndex}`
    params.push(filters.status)
    paramIndex++
  }

  if (filters.search) {
    sql += ` AND (
      p.name ILIKE $${paramIndex} OR
      pt.jurisdiction ILIKE $${paramIndex} OR
      pt.notes ILIKE $${paramIndex}
    )`
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  // Sorting
  const sortColumn = filters.sortBy || 'tax_year'
  const sortOrder = filters.sortOrder || 'desc'
  const validColumns = ['property_name', 'jurisdiction', 'tax_year', 'due_date', 'amount', 'status']
  const column = validColumns.includes(sortColumn) ? sortColumn : 'tax_year'

  if (column === 'property_name') {
    sql += ` ORDER BY p.name ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, pt.due_date DESC`
  } else {
    sql += ` ORDER BY pt.${column} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`
    if (column === 'tax_year') {
      sql += `, pt.due_date DESC`
    }
  }

  return query<PropertyTax & { property_name: string }>(sql, params)
}

export async function getTaxJurisdictions(): Promise<string[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  const result = await query<{ jurisdiction: string }>(
    `SELECT DISTINCT jurisdiction
     FROM property_taxes
     WHERE property_id = ANY($1::uuid[])
     ORDER BY jurisdiction`,
    [ctx.visiblePropertyIds]
  )
  return result.map(r => r.jurisdiction)
}

export async function getUpcomingPropertyTaxes(days: number = 90): Promise<PropertyTax[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || ctx.visiblePropertyIds.length === 0) return []

  return query<PropertyTax>(
    `SELECT pt.*, row_to_json(p.*) as property
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.status = 'pending'
       AND pt.due_date <= CURRENT_DATE + ($1::INTEGER)
       AND pt.property_id = ANY($2::uuid[])
     ORDER BY pt.due_date`,
    [days, ctx.visiblePropertyIds]
  )
}

export async function getPropertyTaxHistory(propertyId: string): Promise<PropertyTax[]> {
  const ctx = await getVisibilityContext()
  if (!ctx || !ctx.visiblePropertyIds.includes(propertyId)) return []

  return query<PropertyTax>(
    `SELECT * FROM property_taxes
     WHERE property_id = $1
     ORDER BY tax_year DESC, installment`,
    [propertyId]
  )
}

export async function getPropertyTax(id: string): Promise<(PropertyTax & { property_name: string }) | null> {
  const ctx = await getVisibilityContext()
  if (!ctx) return null

  const result = await query<PropertyTax & { property_name: string }>(
    `SELECT pt.*, p.name as property_name
     FROM property_taxes pt
     JOIN properties p ON pt.property_id = p.id
     WHERE pt.id = $1
       AND pt.property_id = ANY($2::uuid[])`,
    [id, ctx.visiblePropertyIds]
  )

  return result[0] || null
}
