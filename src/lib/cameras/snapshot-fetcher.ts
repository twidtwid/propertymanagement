// Simplified camera snapshot fetcher (MVP - static snapshots only)
// Phase 1: Nest cameras only

import { query } from '@/lib/db'
import { decryptToken } from '@/lib/encryption'
import DigestFetch from 'digest-fetch'

export interface SnapshotResult {
  imageBuffer: Buffer  // Raw image data
  timestamp: Date
  success: boolean
  error?: string
}

/**
 * Fetch snapshot from Nest camera via Google SDM API
 * Returns image buffer that can be uploaded to Dropbox
 */
export async function fetchNestSnapshot(externalId: string): Promise<SnapshotResult> {
  try {
    const creds = await getNestCredentials()

    // Step 1: Request snapshot generation from Nest
    const response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${process.env.NEST_PROJECT_ID}/devices/${externalId}:executeCommand`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'sdm.devices.commands.CameraImage.GenerateImage',
          params: {},
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Nest API error (${response.status}): ${error}`)
    }

    const data = await response.json()

    // Step 2: Fetch actual image from the temporary URL Nest provides
    const imageResponse = await fetch(data.results.url)

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from Nest URL: ${imageResponse.status}`)
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    return {
      imageBuffer,
      timestamp: new Date(),
      success: true,
    }
  } catch (error) {
    console.error(`Error fetching Nest snapshot for ${externalId}:`, error)
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
 * Uses the snapshot endpoint we've already implemented
 */
export async function fetchNestLegacySnapshot(
  cameraId: string,
  externalId: string
): Promise<SnapshotResult> {
  try {
    const creds = await getNestLegacyCredentials()

    // Fetch snapshot directly from Dropcam API
    const response = await fetch(
      `https://nexusapi-us1.camera.home.nest.com/get_image?uuid=${externalId}&width=1920`,
      {
        headers: {
          Cookie: `user_token=${creds.access_token}`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Referer: 'https://home.nest.com/',
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
