// Camera snapshot sync endpoint
// Called by unified worker every 5 minutes to fetch and store snapshots
// Snapshots stored in public/camera-snapshots/ and served statically

import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { query } from '@/lib/db'
import {
  fetchNestSnapshot,
  fetchNestLegacySnapshot,
  fetchHikvisionSnapshot,
  type SnapshotResult
} from '@/lib/cameras/snapshot-fetcher'

export async function POST(request: NextRequest) {
  // Authenticate with cron secret (same as other cron endpoints)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Camera Sync] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch all cameras with property info for HikVision
    const cameras = await query<{
      id: string
      property_id: string
      external_id: string
      name: string
      provider: string
    }>(
      `SELECT id, property_id, external_id, name, provider
       FROM cameras
       ORDER BY name`
    )

    let updated = 0
    const errors: string[] = []

    console.log(`[Camera Sync] Starting snapshot fetch for ${cameras.length} cameras`)

    // Process each camera
    for (const camera of cameras) {
      try {
        console.log(`[Camera Sync] Fetching snapshot for ${camera.name} (${camera.provider})`)

        // Fetch snapshot based on provider
        let snapshotResult: SnapshotResult
        switch (camera.provider) {
          case 'nest':
            snapshotResult = await fetchNestSnapshot(camera.external_id)
            break
          case 'nest_legacy':
            snapshotResult = await fetchNestLegacySnapshot(camera.id, camera.external_id)
            break
          case 'hikvision':
            snapshotResult = await fetchHikvisionSnapshot(camera.external_id, camera.property_id)
            break
          default:
            console.log(`[Camera Sync] Unknown provider ${camera.provider}, skipping`)
            continue
        }

        if (!snapshotResult.success) {
          console.error(`[Camera Sync] Failed to fetch snapshot for ${camera.name}:`, snapshotResult.error)
          errors.push(`${camera.name}: ${snapshotResult.error}`)

          // Mark camera as error status
          await query(
            `UPDATE cameras SET status = 'error'::camera_status, updated_at = NOW() WHERE id = $1`,
            [camera.id]
          )
          continue
        }

        // Save snapshot to public directory
        const snapshotPath = join(process.cwd(), 'public', 'camera-snapshots', `${camera.id}.jpg`)
        await writeFile(snapshotPath, snapshotResult.imageBuffer)

        // Update camera record with public URL
        const snapshotUrl = `/camera-snapshots/${camera.id}.jpg`
        await query(
          `UPDATE cameras
           SET snapshot_url = $1,
               snapshot_captured_at = $2,
               status = 'online'::camera_status,
               last_online = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [snapshotUrl, snapshotResult.timestamp, camera.id]
        )

        console.log(`[Camera Sync] ✓ Updated ${camera.name}`)
        updated++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Camera Sync] Error processing ${camera.name}:`, errorMsg)
        errors.push(`${camera.name}: ${errorMsg}`)

        // Mark camera as error
        await query(`UPDATE cameras SET status = 'error'::camera_status, updated_at = NOW() WHERE id = $1`, [
          camera.id,
        ])
      }
    }

    console.log(`[Camera Sync] Complete: ${updated}/${cameras.length} cameras updated`)

    return NextResponse.json({
      success: true,
      updated,
      total: cameras.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[Camera Sync] Fatal error:', error)
    return NextResponse.json(
      {
        error: 'Camera sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
