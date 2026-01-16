// Internal stream endpoint for server-side snapshot capture
// Authenticates with CRON_SECRET instead of user session
// Used by Playwright capture script

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getValidNestToken, refreshNestToken } from '@/lib/cameras/nest-auth'

export const dynamic = 'force-dynamic'

interface Camera {
  id: string
  external_id: string
  property_id: string
  name: string
}

export async function GET(request: NextRequest) {
  // Authenticate with cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cameraId = request.nextUrl.searchParams.get('cameraId')
  const offer = request.nextUrl.searchParams.get('offer')

  if (!cameraId || !offer) {
    return NextResponse.json({ error: 'cameraId and offer required' }, { status: 400 })
  }

  try {
    // Get camera
    const cameras = await query<Camera>(
      `SELECT c.id, c.external_id, c.property_id, c.name
       FROM cameras c
       WHERE c.id = $1 AND c.provider = 'nest'`,
      [cameraId]
    )

    if (cameras.length === 0) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 })
    }

    const camera = cameras[0]

    // Get valid Nest access token
    let accessToken = await getValidNestToken()

    // Generate live stream from Nest API
    let response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${process.env.NEST_PROJECT_ID}/devices/${camera.external_id}:executeCommand`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream',
          params: {
            offerSdp: offer
          }
        }),
      }
    )

    // If 401, refresh token and retry
    if (response.status === 401) {
      console.log('[Internal Stream] Token expired, refreshing...')
      accessToken = await refreshNestToken()

      response = await fetch(
        `https://smartdevicemanagement.googleapis.com/v1/enterprises/${process.env.NEST_PROJECT_ID}/devices/${camera.external_id}:executeCommand`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command: 'sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream',
            params: {
              offerSdp: offer
            }
          }),
        }
      )
    }

    if (!response.ok) {
      const error = await response.text()
      console.error('[Internal Stream] Nest API error:', error)
      return NextResponse.json({ error: 'Failed to generate stream' }, { status: 500 })
    }

    const data = await response.json()

    return NextResponse.json({
      answerSdp: data.results.answerSdp,
      expiresAt: data.results.expiresAt,
      mediaSessionId: data.results.mediaSessionId,
    })
  } catch (error) {
    console.error('[Internal Stream] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
