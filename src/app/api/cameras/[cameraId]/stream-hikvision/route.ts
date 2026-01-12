import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface Camera {
  id: string
  external_id: string
  property_id: string
  name: string
  provider: string
}

/**
 * Get MediaMTX WebRTC streaming endpoint for HikVision cameras
 * Returns WHEP endpoint URL for browser to initiate WebRTC stream
 */
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
       WHERE c.id = $1 AND c.provider = 'hikvision'`,
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

    // Return MediaMTX WHEP endpoint
    // MediaMTX path: camera_{external_id} (e.g., camera_1 for Front Door)
    const mediamtxUrl = process.env.MEDIAMTX_URL || 'http://localhost:8889'
    const cameraPath = `camera_${camera.external_id}`

    console.log(`[HikVision Stream] Requesting stream for ${camera.name} (${cameraPath})`)

    return NextResponse.json({
      type: 'webrtc',
      whepUrl: `${mediamtxUrl}/${cameraPath}/whep`,
      cameraId: camera.id,
      cameraName: camera.name,
    })
  } catch (error) {
    console.error('[HikVision Stream] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
