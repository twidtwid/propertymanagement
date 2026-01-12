import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

interface Camera {
  id: string
  external_id: string
  property_id: string
  name: string
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
      `SELECT c.id, c.external_id, c.property_id, c.name
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

    // Get Nest credentials
    const credRows = await query<{ credentials_encrypted: string }>(
      `SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest' LIMIT 1`
    )

    if (credRows.length === 0) {
      return NextResponse.json({ error: 'Nest credentials not configured' }, { status: 500 })
    }

    const credentials = JSON.parse(decryptToken(credRows[0].credentials_encrypted))

    // Generate live stream from Nest API
    const response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${process.env.NEST_PROJECT_ID}/devices/${camera.external_id}:executeCommand`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream',
          params: {
            offerSdp: request.nextUrl.searchParams.get('offer') || ''
          }
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Nest API error:', error)
      return NextResponse.json({ error: 'Failed to generate stream' }, { status: 500 })
    }

    const data = await response.json()

    return NextResponse.json({
      answerSdp: data.results.answerSdp,
      expiresAt: data.results.expiresAt,
      mediaSessionId: data.results.mediaSessionId,
    })
  } catch (error) {
    console.error('Stream error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
