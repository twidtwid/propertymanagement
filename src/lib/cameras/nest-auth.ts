import { query } from '@/lib/db'
import { encryptToken, decryptToken } from '@/lib/encryption'

interface NestCredentials {
  access_token: string
  refresh_token: string
  expires_at: number
}

export async function getNestCredentials(): Promise<NestCredentials> {
  const rows = await query<{ credentials_encrypted: string }>(
    `SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest' LIMIT 1`
  )

  if (rows.length === 0) {
    throw new Error('Nest credentials not configured')
  }

  return JSON.parse(decryptToken(rows[0].credentials_encrypted))
}

export async function refreshNestToken(): Promise<string> {
  const credentials = await getNestCredentials()

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: credentials.refresh_token,
      client_id: process.env.NEST_CLIENT_ID || process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.NEST_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Token refresh failed:', error)
    throw new Error('Failed to refresh Nest OAuth token')
  }

  const data = await response.json()

  // Update credentials in database
  const newCredentials: NestCredentials = {
    access_token: data.access_token,
    refresh_token: credentials.refresh_token, // Refresh token stays the same
    expires_at: Date.now() + data.expires_in * 1000,
  }

  const encrypted = encryptToken(JSON.stringify(newCredentials))

  await query(
    `UPDATE camera_credentials
     SET credentials_encrypted = $1, updated_at = NOW()
     WHERE provider = 'nest'`,
    [encrypted]
  )

  console.log('✓ Nest OAuth token refreshed')

  return data.access_token
}

export async function getValidNestToken(): Promise<string> {
  const credentials = await getNestCredentials()

  // Check if token is expired or about to expire (within 5 minutes)
  if (credentials.expires_at && credentials.expires_at < Date.now() + 5 * 60 * 1000) {
    console.log('Nest token expired, refreshing...')
    return await refreshNestToken()
  }

  return credentials.access_token
}
