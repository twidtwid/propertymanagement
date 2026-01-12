/**
 * Nest Legacy Authentication with Automatic Token Refresh
 *
 * Implementation based on Homebridge-Nest pattern:
 * - Stores issue_token + cookies (long-lived credentials)
 * - Generates short-lived JWT every 55 minutes
 * - No manual refresh required as long as Google session persists
 *
 * References:
 * - https://github.com/chrisjshull/homebridge-nest
 * - https://den.dev/blog/nest/
 */

import { query } from '@/lib/db'
import { decryptToken, encryptToken } from '@/lib/encryption'

interface NestLegacyRefreshCredentials {
  issue_token: string
  cookies: string
  current_jwt?: string
  jwt_expires_at?: string
  last_refresh_at?: string
}

/**
 * Get Google access token from issue_token URL with cookies
 * This is the first step in the Homebridge authentication flow
 */
async function getGoogleAccessToken(
  issueToken: string,
  cookies: string
): Promise<string> {
  const response = await fetch(issueToken, {
    method: 'GET',
    headers: {
      'Sec-Fetch-Mode': 'cors',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'X-Requested-With': 'XmlHttpRequest',
      'Referer': 'https://accounts.google.com/o/oauth2/iframe',
      'cookie': cookies
    }
  })

  if (!response.ok) {
    const text = await response.text()
    if (text.includes('USER_LOGGED_OUT')) {
      throw new Error('Google session expired - need to log in to home.nest.com again')
    }
    throw new Error(`Failed to get Google access token: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Exchange Google access token for Nest JWT
 * This is the second step in the Homebridge authentication flow
 */
async function getNestJWT(googleAccessToken: string): Promise<{ jwt: string, expiresAt: Date }> {
  const response = await fetch('https://nestauthproxyservice-pa.googleapis.com/v1/issue_jwt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${googleAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      embed_google_oauth_access_token: true,
      expire_after: '3600s',  // 1 hour
      google_oauth_access_token: googleAccessToken,
      policy_id: 'authproxy-oauth-policy'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to get Nest JWT: ${response.status}`)
  }

  const data = await response.json()

  // JWT expires in 1 hour from now
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  return {
    jwt: data.jwt,
    expiresAt
  }
}

/**
 * Get credentials from database (issue_token + cookies)
 */
async function getRefreshCredentials(): Promise<NestLegacyRefreshCredentials> {
  const rows = await query<{ credentials_encrypted: string }>(
    `SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest_legacy' LIMIT 1`
  )

  if (rows.length === 0) {
    throw new Error('Nest Legacy credentials not configured')
  }

  return JSON.parse(decryptToken(rows[0].credentials_encrypted))
}

/**
 * Update credentials in database with new JWT
 */
async function updateJWT(jwt: string, expiresAt: Date): Promise<void> {
  const creds = await getRefreshCredentials()

  const updated: NestLegacyRefreshCredentials = {
    ...creds,
    current_jwt: jwt,
    jwt_expires_at: expiresAt.toISOString(),
    last_refresh_at: new Date().toISOString()
  }

  const encrypted = encryptToken(JSON.stringify(updated))

  await query(
    `UPDATE camera_credentials
     SET credentials_encrypted = $1, updated_at = NOW()
     WHERE provider = 'nest_legacy'`,
    [encrypted]
  )
}

/**
 * Get valid Nest JWT, refreshing if needed
 * This is the main function that should be called to get a token
 */
export async function getValidNestJWT(): Promise<string> {
  const creds = await getRefreshCredentials()

  // Check if we have a current JWT and it's still valid (with 5-minute buffer)
  if (creds.current_jwt && creds.jwt_expires_at) {
    const expiresAt = new Date(creds.jwt_expires_at)
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

    if (expiresAt > fiveMinutesFromNow) {
      console.log('[nest_legacy] Using cached JWT (expires:', expiresAt.toISOString(), ')')
      return creds.current_jwt
    }
  }

  // JWT expired or doesn't exist - refresh it
  console.log('[nest_legacy] Refreshing JWT...')

  try {
    // Step 1: Get Google access token from issue_token + cookies
    const googleAccessToken = await getGoogleAccessToken(creds.issue_token, creds.cookies)

    // Step 2: Exchange for Nest JWT
    const { jwt, expiresAt } = await getNestJWT(googleAccessToken)

    // Step 3: Save to database
    await updateJWT(jwt, expiresAt)

    console.log('[nest_legacy] ✓ JWT refreshed successfully (expires:', expiresAt.toISOString(), ')')

    return jwt
  } catch (error) {
    console.error('[nest_legacy] Failed to refresh JWT:', error)

    // If we have an old JWT, try to use it anyway
    if (creds.current_jwt) {
      console.warn('[nest_legacy] Using expired JWT as fallback')
      return creds.current_jwt
    }

    throw error
  }
}

/**
 * Initialize automatic JWT refresh every 55 minutes
 * This should be called when the app starts (in worker or app initialization)
 */
export function startAutomaticRefresh(): NodeJS.Timeout {
  const REFRESH_INTERVAL = 55 * 60 * 1000 // 55 minutes

  const refreshLoop = async () => {
    try {
      await getValidNestJWT()
    } catch (error) {
      console.error('[nest_legacy] Automatic refresh failed:', error)
    }
  }

  // Run initial refresh
  refreshLoop()

  // Schedule periodic refresh
  const interval = setInterval(refreshLoop, REFRESH_INTERVAL)

  console.log('[nest_legacy] Automatic JWT refresh started (every 55 minutes)')

  return interval
}
