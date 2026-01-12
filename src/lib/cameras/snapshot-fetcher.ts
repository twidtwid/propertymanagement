// Simplified camera snapshot fetcher (MVP - static snapshots only)
// Phase 1: Nest cameras only

import { query } from '@/lib/db'
import { decryptToken } from '@/lib/encryption'

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
 * Placeholder for Hikvision (Phase 2)
 */
export async function fetchHikvisionSnapshot(
  externalId: string,
  propertyId: string
): Promise<SnapshotResult> {
  throw new Error('Hikvision not yet implemented - Phase 2')
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
