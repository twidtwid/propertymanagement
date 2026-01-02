import { Dropbox, DropboxAuth } from "dropbox"
import { query, queryOne } from "@/lib/db"
import { encryptToken, decryptToken } from "@/lib/encryption"
import type { DropboxOAuthTokens, DropboxCredentials } from "./types"

const DROPBOX_SCOPES = [
  "files.metadata.read",
  "files.content.read",
  "sharing.read",
  "account_info.read",
]

/**
 * Get the Dropbox Auth client configured with credentials from environment.
 */
export function getDropboxAuth(): DropboxAuth {
  const clientId = process.env.DROPBOX_APP_KEY
  const clientSecret = process.env.DROPBOX_APP_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Dropbox OAuth credentials not configured in environment")
  }

  return new DropboxAuth({
    clientId,
    clientSecret,
    fetch: fetch, // Explicitly pass global fetch for Node.js compatibility
  })
}

/**
 * Get the redirect URI for OAuth callback.
 */
function getRedirectUri(): string {
  const redirectUri = process.env.DROPBOX_REDIRECT_URI
  if (!redirectUri) {
    throw new Error("DROPBOX_REDIRECT_URI environment variable is not set")
  }
  return redirectUri
}

/**
 * Generate the OAuth authorization URL for Dropbox access.
 */
export async function getAuthUrl(): Promise<string> {
  const dbxAuth = getDropboxAuth()

  const authUrl = await dbxAuth.getAuthenticationUrl(
    getRedirectUri(),
    undefined, // state
    "code",
    "offline", // token_access_type - offline to get refresh token
    DROPBOX_SCOPES,
    "none",
    false
  )

  return authUrl as string
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<DropboxCredentials> {
  const dbxAuth = getDropboxAuth()

  const response = await dbxAuth.getAccessTokenFromCode(getRedirectUri(), code)
  const result = response.result as {
    access_token: string
    refresh_token: string
    expires_in: number
    account_id?: string
  }

  if (!result.access_token || !result.refresh_token) {
    throw new Error("Failed to obtain required tokens from Dropbox")
  }

  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expiry_date: Date.now() + result.expires_in * 1000,
    account_id: result.account_id,
  }
}

/**
 * Store OAuth tokens in the database (encrypted).
 */
export async function storeTokens(
  email: string,
  credentials: DropboxCredentials
): Promise<void> {
  const accessTokenEncrypted = encryptToken(credentials.access_token)
  const refreshTokenEncrypted = encryptToken(credentials.refresh_token)
  const tokenExpiry = new Date(credentials.expiry_date).toISOString()

  await query(
    `INSERT INTO dropbox_oauth_tokens (
      user_email,
      access_token_encrypted,
      refresh_token_encrypted,
      token_expiry,
      account_id,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_email)
    DO UPDATE SET
      access_token_encrypted = $2,
      refresh_token_encrypted = $3,
      token_expiry = $4,
      account_id = $5,
      updated_at = NOW()`,
    [email, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiry, credentials.account_id]
  )
}

/**
 * Retrieve stored OAuth tokens for a user email.
 */
export async function getStoredTokens(
  email: string
): Promise<DropboxCredentials | null> {
  const row = await queryOne<DropboxOAuthTokens>(
    `SELECT * FROM dropbox_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  if (!row) {
    return null
  }

  return {
    access_token: decryptToken(row.access_token_encrypted),
    refresh_token: decryptToken(row.refresh_token_encrypted),
    expiry_date: new Date(row.token_expiry).getTime(),
    account_id: row.account_id || undefined,
  }
}

/**
 * Check if Dropbox is connected for a specific email.
 */
export async function isDropboxConnected(email: string): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM dropbox_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  return row !== null && parseInt(row.count) > 0
}

/**
 * Get the email of any connected Dropbox account.
 * Since we share one Dropbox connection across all users, this returns
 * whichever account has Dropbox connected.
 */
export async function getConnectedDropboxEmail(): Promise<string | null> {
  const row = await queryOne<{ user_email: string }>(
    `SELECT user_email FROM dropbox_oauth_tokens LIMIT 1`
  )
  return row?.user_email || null
}

/**
 * Get the Dropbox connection info for display.
 */
export async function getDropboxConnectionInfo(email: string): Promise<{
  isConnected: boolean
  accountId: string | null
  rootFolderPath: string | null
  connectedAt: string | null
}> {
  const row = await queryOne<DropboxOAuthTokens>(
    `SELECT account_id, root_folder_path, created_at FROM dropbox_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  if (!row) {
    return {
      isConnected: false,
      accountId: null,
      rootFolderPath: null,
      connectedAt: null,
    }
  }

  return {
    isConnected: true,
    accountId: row.account_id,
    rootFolderPath: row.root_folder_path,
    connectedAt: row.created_at,
  }
}

/**
 * Revoke and delete stored tokens for a user.
 */
export async function revokeTokens(email: string): Promise<void> {
  const tokens = await getStoredTokens(email)

  if (tokens?.access_token) {
    try {
      const dbx = new Dropbox({ accessToken: tokens.access_token, fetch: fetch })
      await dbx.authTokenRevoke()
    } catch (error) {
      // Log but don't fail - token might already be invalid
      console.warn("Failed to revoke token with Dropbox:", error)
    }
  }

  await query(`DELETE FROM dropbox_oauth_tokens WHERE user_email = $1`, [email])
}

/**
 * Refresh the access token if it's expired or about to expire.
 * Returns true if the token was refreshed.
 */
export async function refreshTokenIfNeeded(email: string): Promise<boolean> {
  const row = await queryOne<DropboxOAuthTokens>(
    `SELECT * FROM dropbox_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  if (!row) {
    throw new Error(`No Dropbox tokens found for ${email}`)
  }

  const expiryTime = new Date(row.token_expiry).getTime()
  const now = Date.now()

  // Refresh if token expires in less than 5 minutes
  if (expiryTime - now > 5 * 60 * 1000) {
    return false
  }

  const dbxAuth = getDropboxAuth()
  dbxAuth.setRefreshToken(decryptToken(row.refresh_token_encrypted))

  await dbxAuth.refreshAccessToken()
  const newAccessToken = dbxAuth.getAccessToken()

  if (!newAccessToken) {
    throw new Error("Failed to refresh Dropbox access token")
  }

  // Dropbox tokens expire in 4 hours
  const newExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  const accessTokenEncrypted = encryptToken(newAccessToken)

  await query(
    `UPDATE dropbox_oauth_tokens
     SET access_token_encrypted = $1, token_expiry = $2, updated_at = NOW()
     WHERE user_email = $3`,
    [accessTokenEncrypted, newExpiry, email]
  )

  return true
}

/**
 * Get an authenticated Dropbox client for the given user.
 * Automatically refreshes the token if needed.
 */
export async function getDropboxClient(email: string): Promise<Dropbox> {
  await refreshTokenIfNeeded(email)

  const row = await queryOne<DropboxOAuthTokens>(
    `SELECT * FROM dropbox_oauth_tokens WHERE user_email = $1`,
    [email]
  )
  if (!row) {
    throw new Error(`No Dropbox connection for ${email}`)
  }

  const accessToken = decryptToken(row.access_token_encrypted)

  // Use namespace ID if set (for shared folders)
  if (row.namespace_id) {
    return new Dropbox({
      accessToken,
      fetch: fetch,
      pathRoot: JSON.stringify({ ".tag": "namespace_id", "namespace_id": row.namespace_id })
    })
  }

  return new Dropbox({ accessToken, fetch: fetch })
}
