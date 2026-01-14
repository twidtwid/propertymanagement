// Camera snapshot sync endpoint
// Called by unified worker every 5 minutes to update all camera snapshots

// Import fetch polyfill first (fixes Dropbox SDK issues in production)
import 'isomorphic-fetch'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { decryptToken } from '@/lib/encryption'
import { fetchNestSnapshot, fetchNestLegacySnapshot } from '@/lib/cameras/snapshot-fetcher'
import { Dropbox } from 'dropbox'

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
    const cameras = await query<{ id: string; property_id: string; external_id: string; name: string; provider: string; property_name: string }>(
      `SELECT c.*, p.name as property_name
       FROM cameras c
       JOIN properties p ON c.property_id = p.id
       ORDER BY c.name`
    )

    let updated = 0
    const errors: string[] = []

    console.log(`[Camera Sync] Starting snapshot sync for ${cameras.length} cameras`)

    // Get Dropbox access token
    const tokenRow = await queryOne<{ access_token_encrypted: string; namespace_id: string | null }>(
      'SELECT access_token_encrypted, namespace_id FROM dropbox_oauth_tokens LIMIT 1'
    )

    if (!tokenRow) {
      throw new Error('Dropbox not connected')
    }

    const accessToken = decryptToken(tokenRow.access_token_encrypted)
    const dbx = new Dropbox({
      accessToken,
      selectUser: tokenRow.namespace_id || undefined,
      fetch: fetch // Explicitly pass fetch to avoid "this.fetch is not a function" error
    })

    // Process each camera
    for (const camera of cameras) {
      try {
        console.log(`[Camera Sync] Fetching snapshot for ${camera.name} (${camera.provider})`)

        // Fetch snapshot based on provider
        let snapshotResult
        switch (camera.provider) {
          case 'nest':
            snapshotResult = await fetchNestSnapshot(camera.external_id)
            break
          case 'nest_legacy':
            snapshotResult = await fetchNestLegacySnapshot(camera.id, camera.external_id)
            break
          case 'hikvision':
            // TODO: Phase 2
            console.log(`[Camera Sync] Hikvision not yet implemented, skipping ${camera.name}`)
            continue
          case 'securityspy':
            // TODO: Phase 3
            console.log(`[Camera Sync] SecuritySpy not yet implemented, skipping ${camera.name}`)
            continue
          default:
            throw new Error(`Unknown provider: ${camera.provider}`)
        }

        if (!snapshotResult.success) {
          console.error(`[Camera Sync] Failed to fetch snapshot for ${camera.name}:`, snapshotResult.error)
          errors.push(`${camera.name}: ${snapshotResult.error}`)

          // Mark camera as error status
          await query(
            `UPDATE cameras SET status = 'error', updated_at = NOW() WHERE id = $1`,
            [camera.id]
          )
          continue
        }

        // Upload to Dropbox: /Cameras/{property}/{camera}/{timestamp}.jpg
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) // 2026-01-11T16-30-00
        const dropboxPath = `/Cameras/${camera.property_name}/${camera.name}/${timestamp}.jpg`

        console.log(`[Camera Sync] Uploading snapshot to Dropbox: ${dropboxPath}`)

        await dbx.filesUpload({
          path: dropboxPath,
          contents: snapshotResult.imageBuffer,
          mode: { '.tag': 'add' },
          autorename: false,
        })

        // Store Dropbox path as snapshot_url (sharing links have issues in production)
        // Format: dropbox://{path} so we can retrieve via Dropbox API later
        const snapshotUrl = `dropbox://${dropboxPath}`

        // Update camera record
        await query(
          `UPDATE cameras
           SET snapshot_url = $1,
               snapshot_captured_at = $2,
               status = 'online',
               last_online = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [snapshotUrl, snapshotResult.timestamp, camera.id]
        )

        console.log(`[Camera Sync] Successfully updated ${camera.name}`)
        updated++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Camera Sync] Error processing ${camera.name}:`, errorMsg)
        errors.push(`${camera.name}: ${errorMsg}`)

        // Mark camera as error
        await query(`UPDATE cameras SET status = 'error', updated_at = NOW() WHERE id = $1`, [
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
        error: 'Snapshot sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
