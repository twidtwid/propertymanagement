/**
 * Nest JWT Refresh Endpoint
 *
 * Called by the worker every 10 minutes to keep the Google session alive.
 * This mimics what Homebridge does - frequent requests to Google's endpoint
 * prevent the session from expiring due to inactivity.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getValidNestJWT } from '@/lib/cameras/nest-legacy-refresh'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Authenticate with cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Nest JWT Refresh] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Nest JWT Refresh] Starting proactive refresh...')

    const jwt = await getValidNestJWT()

    // Check if we actually got a valid JWT
    if (!jwt || jwt.length < 100) {
      console.error('[Nest JWT Refresh] Got invalid JWT')
      return NextResponse.json({
        success: false,
        error: 'Invalid JWT returned'
      }, { status: 500 })
    }

    console.log('[Nest JWT Refresh] ✓ JWT is valid')

    return NextResponse.json({
      success: true,
      message: 'JWT refreshed/validated successfully',
      jwtPreview: jwt.substring(0, 20) + '...'
    })
  } catch (error) {
    console.error('[Nest JWT Refresh] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
