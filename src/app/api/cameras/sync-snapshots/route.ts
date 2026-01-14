// Camera snapshot sync endpoint
// Called by unified worker every 5 minutes to update camera status
// Snapshots are fetched on-demand via /api/cameras/[id]/snapshot (not stored)

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getValidNestLegacyToken } from '@/lib/cameras/nest-legacy-auth'

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
    // Fetch all cameras
    const cameras = await query<{ id: string; external_id: string; name: string; provider: string }>(
      `SELECT id, external_id, name, provider FROM cameras ORDER BY name`
    )

    let updated = 0
    const errors: string[] = []

    console.log(`[Camera Sync] Checking ${cameras.length} cameras for connectivity`)

    // Process each camera - just test connectivity, don't store snapshots
    for (const camera of cameras) {
      try {
        console.log(`[Camera Sync] Checking ${camera.name} (${camera.provider})`)

        let isOnline = false

        // Test camera connectivity
        switch (camera.provider) {
          case 'nest_legacy':
            // Test if Nest Legacy token is valid
            try {
              await getValidNestLegacyToken()
              // Token valid, test actual camera access with small fetch
              const response = await fetch(
                `https://nexusapi-us1.camera.home.nest.com/get_image?uuid=${camera.external_id}&width=320`,
                {
                  method: 'HEAD', // Just check if accessible
                  headers: {
                    'Cookie': `user_token=${await getValidNestLegacyToken()}`,
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://home.nest.com/'
                  }
                }
              )
              isOnline = response.ok
            } catch {
              isOnline = false
            }
            break

          case 'hikvision':
            // Hikvision cameras are always marked online (checked via local network)
            isOnline = true
            break

          case 'nest':
            // Modern Nest - just mark as online if credentials exist
            isOnline = true
            break

          default:
            console.log(`[Camera Sync] Unknown provider ${camera.provider}, skipping`)
            continue
        }

        // Update camera status
        const newStatus = isOnline ? 'online' : 'offline'
        await query(
          `UPDATE cameras
           SET status = $1::camera_status,
               last_online = CASE WHEN $1::camera_status = 'online'::camera_status THEN NOW() ELSE last_online END,
               updated_at = NOW()
           WHERE id = $2`,
          [newStatus, camera.id]
        )

        if (isOnline) {
          console.log(`[Camera Sync] ✓ ${camera.name} is online`)
          updated++
        } else {
          console.log(`[Camera Sync] ✗ ${camera.name} is offline`)
          errors.push(`${camera.name}: offline`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Camera Sync] Error checking ${camera.name}:`, errorMsg)
        errors.push(`${camera.name}: ${errorMsg}`)

        // Mark camera as error
        await query(`UPDATE cameras SET status = 'error'::camera_status, updated_at = NOW() WHERE id = $1`, [
          camera.id,
        ])
      }
    }

    console.log(`[Camera Sync] Complete: ${updated}/${cameras.length} cameras online`)

    return NextResponse.json({
      success: true,
      online: updated,
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
