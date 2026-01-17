// Camera-related actions

"use server"

import { query } from "../db"
import type { Camera } from "@/types/database"

export interface CamerasByProperty {
  property: {
    id: string
    name: string
    city: string
    state: string
  }
  cameras: Camera[]
}

/**
 * Get all cameras grouped by property, respecting property visibility
 * Used for /cameras page to show all cameras the user has access to
 */
export async function getCamerasGroupedByProperty(userId: string): Promise<CamerasByProperty[]> {
  const rows = await query<{
    property_id: string
    property_name: string
    city: string
    state: string | null
    camera_id: string
    camera_name: string
    location: string | null
    status: string
    provider: string
    snapshot_url: string | null
    snapshot_captured_at: string | null
    last_online: string | null
  }>(
    `SELECT
       p.id as property_id, p.name as property_name, p.city, p.state,
       c.id as camera_id, c.name as camera_name, c.location, c.status,
       c.provider, c.snapshot_url, c.snapshot_captured_at, c.last_online
     FROM properties p
     JOIN cameras c ON c.property_id = p.id
     LEFT JOIN property_visibility pv ON pv.property_id = p.id
     WHERE pv.user_id = $1 OR NOT EXISTS (
       SELECT 1 FROM property_visibility WHERE property_id = p.id
     )
     ORDER BY p.name, c.name`,
    [userId]
  )

  // Group by property
  const grouped = new Map<string, CamerasByProperty>()

  for (const row of rows) {
    if (!grouped.has(row.property_id)) {
      grouped.set(row.property_id, {
        property: {
          id: row.property_id,
          name: row.property_name,
          city: row.city,
          state: row.state || '',
        },
        cameras: [],
      })
    }

    const camera: Camera = {
      id: row.camera_id,
      property_id: row.property_id,
      external_id: '', // Not needed for display
      name: row.camera_name,
      location: row.location,
      status: row.status as Camera['status'],
      provider: row.provider as Camera['provider'],
      snapshot_url: row.snapshot_url,
      // Convert to ISO format so JavaScript Date parses timezone correctly
      snapshot_captured_at: row.snapshot_captured_at ? new Date(row.snapshot_captured_at).toISOString() : null,
      last_online: row.last_online ? new Date(row.last_online).toISOString() : null,
      created_at: '',
      updated_at: '',
    }

    grouped.get(row.property_id)!.cameras.push(camera)
  }

  return Array.from(grouped.values())
}

/**
 * Get all cameras for a specific property
 * Used for property detail page cameras tab
 */
export async function getCamerasByProperty(propertyId: string): Promise<Camera[]> {
  return query<Camera>(
    `SELECT * FROM cameras WHERE property_id = $1 ORDER BY name`,
    [propertyId]
  )
}

/**
 * Get a single camera by ID
 */
export async function getCameraById(cameraId: string): Promise<Camera | null> {
  const rows = await query<Camera>(`SELECT * FROM cameras WHERE id = $1`, [cameraId])
  return rows[0] || null
}
