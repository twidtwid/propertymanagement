import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { getValidNestLegacyToken } from '@/lib/cameras/nest-legacy-auth'

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

    // Only handle nest_legacy cameras (modern Nest uses WebRTC stream)
    if (camera.provider !== 'nest_legacy') {
      return NextResponse.json(
        { error: 'Snapshot endpoint only supports nest_legacy cameras' },
        { status: 400 }
      )
    }

    // Get valid access token from encrypted credentials (server-side, like modern Nest)
    const cztoken = await getValidNestLegacyToken()

    console.log(`[nest_legacy] Fetching snapshot for ${camera.name}`)
    console.log(`[nest_legacy] Token length: ${cztoken.length}`)
    console.log(`[nest_legacy] Token prefix: ${cztoken.substring(0, 30)}...`)

    // Fetch snapshot from Nest camera API
    // Modern endpoint format from https://den.dev/blog/nest/
    const snapshotUrl = `https://nexusapi-us1.camera.home.nest.com/get_image?uuid=${camera.external_id}&width=1280`

    console.log(`[nest_legacy] URL: ${snapshotUrl}`)

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
      return NextResponse.json(
        { error: `Failed to fetch snapshot: HTTP ${response.status}` },
        { status: 500 }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('image')) {
      console.error('[nest_legacy] Unexpected content-type:', contentType)
      return NextResponse.json(
        { error: 'Invalid response from camera' },
        { status: 500 }
      )
    }

    // Get image data and return it
    const imageBuffer = await response.arrayBuffer()

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
