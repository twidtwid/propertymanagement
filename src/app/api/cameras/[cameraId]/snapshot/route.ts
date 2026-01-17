import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { getValidNestLegacyToken } from '@/lib/cameras/nest-legacy-auth'
import { fetchHikvisionSnapshot } from '@/lib/cameras/snapshot-fetcher'
import {
  getCachedSnapshot,
  setCachedSnapshot,
  getLastSnapshot,
} from '@/lib/cameras/snapshot-cache'

export const dynamic = 'force-dynamic'

interface Camera {
  id: string
  external_id: string
  property_id: string
  name: string
  provider: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cameraId: string } }
) {
  try {
    const user = await getUser()

    if (!user || user.role === 'bookkeeper') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get camera
    const cameras = await query<Camera>(
      `SELECT c.id, c.external_id, c.property_id, c.name, c.provider
       FROM cameras c
       WHERE c.id = $1`,
      [params.cameraId]
    )

    if (cameras.length === 0) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 })
    }

    const camera = cameras[0]

    // Check property access
    const access = await query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM property_visibility pv
       WHERE pv.property_id = $1 AND pv.user_id = $2`,
      [camera.property_id, user.id]
    )

    if (access[0].count === 0) {
      return NextResponse.json({ error: 'No access to this camera' }, { status: 403 })
    }

    // Handle different camera providers
    if (camera.provider === 'hikvision') {
      return await handleHikvisionSnapshot(camera, request)
    } else if (camera.provider === 'nest_legacy') {
      return await handleNestLegacySnapshot(camera)
    } else {
      return NextResponse.json(
        { error: `Snapshot endpoint does not support ${camera.provider} cameras` },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[Snapshot] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Handle HikVision snapshot with server-side caching (10-minute TTL)
 * Use ?live=true query parameter to bypass cache for fullscreen "live" view
 */
async function handleHikvisionSnapshot(
  camera: Camera,
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Check for live=true parameter to bypass cache
    const searchParams = request.nextUrl.searchParams
    const bypassCache = searchParams.get('live') === 'true'

    // Check cache first (10-minute TTL) unless bypassing
    if (!bypassCache) {
      const cached = getCachedSnapshot(camera.id)
      if (cached) {
        console.log(`[HikVision] Cache HIT for ${camera.name}`)
        return new NextResponse(new Uint8Array(cached.buffer), {
          headers: {
            'Content-Type': 'image/jpeg',
            'X-Snapshot-Cached': 'true',
            'X-Snapshot-Age': String(Date.now() - cached.timestamp.getTime()),
          },
        })
      }
    }

    console.log(
      `[HikVision] ${bypassCache ? 'LIVE mode' : 'Cache MISS'} for ${camera.name} - fetching from ISAPI`
    )

    // Fetch fresh snapshot from ISAPI
    const result = await fetchHikvisionSnapshot(camera.external_id, camera.property_id)

    if (result.success && result.imageBuffer.length > 0) {
      // Cache successful fetch
      setCachedSnapshot(camera.id, result.imageBuffer)

      return new NextResponse(new Uint8Array(result.imageBuffer), {
        headers: {
          'Content-Type': 'image/jpeg',
          'X-Snapshot-Cached': 'false',
        },
      })
    } else {
      // Fetch failed - try to return last cached snapshot
      console.warn(`[HikVision] Fetch failed for ${camera.name}: ${result.error}`)

      const lastSnapshot = getLastSnapshot(camera.id)
      if (lastSnapshot) {
        console.log(`[HikVision] Returning stale cached snapshot for ${camera.name}`)
        return new NextResponse(new Uint8Array(lastSnapshot), {
          headers: {
            'Content-Type': 'image/jpeg',
            'X-Snapshot-Status': 'stale',
            'X-Snapshot-Error': result.error || 'Unknown error',
          },
        })
      }

      // No cached snapshot available
      return NextResponse.json(
        { error: `Snapshot unavailable: ${result.error}` },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error(`[HikVision] Snapshot error for ${camera.name}:`, error)
    return NextResponse.json({ error: 'Failed to fetch snapshot' }, { status: 500 })
  }
}

/**
 * Handle Nest Legacy snapshot with fallback to cached snapshot when token expired
 */
async function handleNestLegacySnapshot(camera: Camera): Promise<NextResponse> {
  try {
    // Get valid access token from encrypted credentials (server-side, like modern Nest)
    const cztoken = await getValidNestLegacyToken()

    // Fetch snapshot from Nest camera API
    // Modern endpoint format from https://den.dev/blog/nest/
    const snapshotUrl = `https://nexusapi-us1.camera.home.nest.com/get_image?uuid=${camera.external_id}&width=1280`

    // Dropcam API uses cookie-based authentication with user_token cookie
    // Reference: https://den.dev/blog/nest/
    const response = await fetch(snapshotUrl, {
      headers: {
        Cookie: `user_token=${cztoken}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Referer: 'https://home.nest.com/',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[nest_legacy] Dropcam API error:', response.status, errorText.substring(0, 200))

      // On 403 (token expired), try to return last cached snapshot
      if (response.status === 403) {
        const lastSnapshot = getLastSnapshot(camera.id)
        if (lastSnapshot) {
          console.log(`[nest_legacy] Token expired - returning stale cached snapshot for ${camera.name}`)
          return new NextResponse(new Uint8Array(lastSnapshot), {
            headers: {
              'Content-Type': 'image/jpeg',
              'X-Snapshot-Status': 'stale',
              'X-Snapshot-Error': 'Token expired (403) - using cached snapshot',
            },
          })
        }
      }

      return NextResponse.json(
        { error: `Failed to fetch snapshot: HTTP ${response.status}` },
        { status: 500 }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('image')) {
      console.error('[nest_legacy] Unexpected content-type:', contentType)
      return NextResponse.json({ error: 'Invalid response from camera' }, { status: 500 })
    }

    // Get image data and return it
    const imageBuffer = await response.arrayBuffer()

    // Cache successful fetch for fallback
    setCachedSnapshot(camera.id, Buffer.from(imageBuffer))

    console.log(`[nest_legacy] ✓ Fetched snapshot for ${camera.name} (${imageBuffer.byteLength} bytes)`)

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('[nest_legacy] Snapshot error:', error)

    // On any error, try to return last cached snapshot
    const lastSnapshot = getLastSnapshot(camera.id)
    if (lastSnapshot) {
      console.log(`[nest_legacy] Error occurred - returning stale cached snapshot for ${camera.id}`)
      return new NextResponse(new Uint8Array(lastSnapshot), {
        headers: {
          'Content-Type': 'image/jpeg',
          'X-Snapshot-Status': 'stale',
          'X-Snapshot-Error': error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
