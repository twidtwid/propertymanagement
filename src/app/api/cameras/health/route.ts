import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Camera {
  id: string
  name: string
  provider: string
}

/**
 * Health check endpoint for Nest Legacy cameras
 * Returns the status of camera snapshots to verify tokens are working
 */
export async function GET() {
  try {
    // Get all nest_legacy cameras
    const cameras = await query<Camera>(
      `SELECT id, name, provider FROM cameras WHERE provider = 'nest_legacy' ORDER BY name`
    )

    const results = await Promise.all(
      cameras.map(async (camera) => {
        try {
          // Try to fetch snapshot
          const response = await fetch(
            `http://localhost:3000/api/cameras/${camera.id}/snapshot`,
            {
              headers: {
                'Cookie': 'session=test' // Mock auth for health check
              }
            }
          )

          return {
            name: camera.name,
            id: camera.id,
            status: response.ok ? 'working' : 'failed',
            statusCode: response.status,
            timestamp: new Date().toISOString()
          }
        } catch (error) {
          return {
            name: camera.name,
            id: camera.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        }
      })
    )

    const allWorking = results.every(r => r.status === 'working')

    return NextResponse.json({
      overall: allWorking ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      cameras: results
    })
  } catch (error) {
    console.error('[Camera Health] Error:', error)
    return NextResponse.json(
      {
        overall: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
