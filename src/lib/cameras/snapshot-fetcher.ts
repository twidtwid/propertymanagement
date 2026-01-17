// Simplified camera snapshot fetcher (MVP - static snapshots only)
// Phase 1: Nest cameras only

import { query } from '@/lib/db'
import { decryptToken } from '@/lib/encryption'
import DigestFetch from 'digest-fetch'
import { getValidNestJWT } from './nest-legacy-refresh'

export interface SnapshotResult {
  imageBuffer: Buffer  // Raw image data
  timestamp: Date
  success: boolean
  error?: string
}

/**
 * Fetch snapshot from Nest camera via WebRTC using Playwright
 * Battery cameras don't support GenerateImage, so we connect via WebRTC
 * and capture a frame from the live stream
 */
export async function fetchNestSnapshot(externalId: string, cameraId?: string): Promise<SnapshotResult> {
  // If no cameraId provided, we can't use WebRTC capture
  if (!cameraId) {
    return {
      imageBuffer: Buffer.from(''),
      timestamp: new Date(),
      success: false,
      error: 'Camera ID required for Nest WebRTC snapshot',
    }
  }

  try {
    const { spawn } = await import('child_process')
    const path = await import('path')
    const fs = await import('fs')

    const outputPath = path.join(process.cwd(), 'public', 'camera-snapshots', `${cameraId}.jpg`)
    const scriptPath = path.join(process.cwd(), 'scripts', 'capture-nest-snapshot.js')

    // Use internal Docker network URL if in container, otherwise localhost
    const appUrl = process.env.APP_HOST
      ? `http://${process.env.APP_HOST}:${process.env.APP_PORT || 3000}`
      : 'http://localhost:3000'

    console.log(`[Nest Snapshot] Capturing via WebRTC for camera ${cameraId}`)

    // Run the Playwright capture script asynchronously to avoid blocking the event loop
    const result = await new Promise<string>((resolve, reject) => {
      const child = spawn('node', [scriptPath, cameraId, outputPath], {
        env: { ...process.env, APP_URL: appUrl },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      // Set a timeout
      const timeout = setTimeout(() => {
        child.kill()
        reject(new Error('Capture script timed out after 90 seconds'))
      }, 90000)

      child.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(stderr || stdout || `Script exited with code ${code}`))
        }
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    // Parse the JSON result from the script
    const lines = result.trim().split('\n')
    const jsonLine = lines.find(line => line.startsWith('{'))

    if (jsonLine) {
      const parsed = JSON.parse(jsonLine)
      if (parsed.success) {
        // Read the saved image
        const imageBuffer = fs.readFileSync(outputPath)
        return {
          imageBuffer,
          timestamp: new Date(),
          success: true,
        }
      } else {
        throw new Error(parsed.error || 'Capture failed')
      }
    }

    throw new Error('No result from capture script')

  } catch (error) {
    console.error(`Error fetching Nest WebRTC snapshot:`, error)
    return {
      imageBuffer: Buffer.from(''),
      timestamp: new Date(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get Nest credentials from database
 * Credentials are stored encrypted in camera_credentials table
 */
async function getNestCredentials(): Promise<{ access_token: string; refresh_token: string }> {
  const rows = await query<{ credentials_encrypted: string }>(
    'SELECT credentials_encrypted FROM camera_credentials WHERE provider = $1',
    ['nest']
  )

  if (rows.length === 0) {
    throw new Error('Nest credentials not configured - run setup first')
  }

  const encrypted = rows[0].credentials_encrypted
  const creds = JSON.parse(decryptToken(encrypted))

  // TODO: Add token refresh logic if access_token is expired
  // For MVP, assume tokens are fresh (manual refresh if needed)

  return creds
}

/**
 * Fetch snapshot from HikVision camera via ISAPI
 * External ID format: "1" through "10" (camera number)
 * Snapshot channel: {id}01 (e.g., Camera 1 → Channel 101)
 */
export async function fetchHikvisionSnapshot(
  externalId: string,
  propertyId: string
): Promise<SnapshotResult> {
  try {
    const creds = await getHikvisionCredentials(propertyId)

    // Calculate snapshot channel ID (e.g., "1" → "101")
    const cameraNum = parseInt(externalId, 10)
    if (isNaN(cameraNum) || cameraNum < 1 || cameraNum > 10) {
      throw new Error(`Invalid camera ID: ${externalId}`)
    }
    const snapshotChannel = cameraNum * 100 + 1 // 101, 201, 301, etc.

    // Build snapshot URL
    const snapshotUrl = `${creds.base_url}/ISAPI/Streaming/channels/${snapshotChannel}/picture`

    console.log(`[HikVision] Fetching snapshot for camera ${externalId} (channel ${snapshotChannel})`)

    // Fetch with Digest Auth using digest-fetch
    const client = new DigestFetch(creds.username, creds.password)

    const response = await client.fetch(snapshotUrl, {
      method: 'GET',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ISAPI error (${response.status}): ${errorText.substring(0, 200)}`)
    }

    // Verify content type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('image')) {
      throw new Error(`Unexpected content-type: ${contentType}`)
    }

    // Return image buffer
    const imageBuffer = Buffer.from(await response.arrayBuffer())

    console.log(`[HikVision] Successfully fetched snapshot for camera ${externalId} (${imageBuffer.length} bytes)`)

    return {
      imageBuffer,
      timestamp: new Date(),
      success: true,
    }
  } catch (error) {
    console.error(`[HikVision] Error fetching snapshot for camera ${externalId}:`, error)
    return {
      imageBuffer: Buffer.from(''),
      timestamp: new Date(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get HikVision credentials for a property
 */
async function getHikvisionCredentials(propertyId: string): Promise<{
  base_url: string
  rtsp_base_url: string
  username: string
  password: string
}> {
  const rows = await query<{ credentials_encrypted: string }>(
    'SELECT credentials_encrypted FROM camera_credentials WHERE provider = $1 AND property_id = $2',
    ['hikvision', propertyId]
  )

  if (rows.length === 0) {
    throw new Error('HikVision credentials not configured for this property')
  }

  const encrypted = rows[0].credentials_encrypted
  const creds = JSON.parse(decryptToken(encrypted))

  return creds
}

/**
 * Fetch snapshot from legacy Nest camera via Dropcam API
 * Uses JWT auth with automatic refresh (Homebridge pattern)
 */
export async function fetchNestLegacySnapshot(
  cameraId: string,
  externalId: string
): Promise<SnapshotResult> {
  try {
    // Get valid JWT (auto-refreshes if expired)
    const jwt = await getValidNestJWT()

    // Fetch snapshot from Dropcam API using JWT auth
    const response = await fetch(
      `https://nexusapi-us1.camera.home.nest.com/get_image?uuid=${externalId}&width=1920`,
      {
        headers: {
          'Authorization': `Basic ${jwt}`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://home.nest.com/',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dropcam API error (${response.status}): ${errorText.substring(0, 200)}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('image')) {
      throw new Error(`Unexpected content-type: ${contentType}`)
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer())

    return {
      imageBuffer,
      timestamp: new Date(),
      success: true,
    }
  } catch (error) {
    console.error(`Error fetching Nest Legacy snapshot for ${externalId}:`, error)
    return {
      imageBuffer: Buffer.from(''),
      timestamp: new Date(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get Nest Legacy credentials from database
 */
async function getNestLegacyCredentials(): Promise<{ access_token: string }> {
  const rows = await query<{ credentials_encrypted: string }>(
    'SELECT credentials_encrypted FROM camera_credentials WHERE provider = $1',
    ['nest_legacy']
  )

  if (rows.length === 0) {
    throw new Error('Nest Legacy credentials not configured')
  }

  const encrypted = rows[0].credentials_encrypted
  const creds = JSON.parse(decryptToken(encrypted))

  return creds
}

/**
 * Placeholder for SecuritySpy (Phase 3)
 */
export async function fetchSecuritySpySnapshot(
  externalId: string,
  propertyId: string
): Promise<SnapshotResult> {
  throw new Error('SecuritySpy not yet implemented - Phase 3')
}
