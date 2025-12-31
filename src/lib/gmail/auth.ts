import { google } from "googleapis"
import { Credentials } from "google-auth-library"
import { query, queryOne } from "@/lib/db"
import { encryptToken, decryptToken } from "@/lib/encryption"
import type { GmailOAuthTokens } from "@/types/gmail"

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
]

/**
 * Get the OAuth2 client configured with credentials from environment.
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth credentials not configured in environment")
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/**
 * Generate the OAuth authorization URL for Gmail access.
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
  })
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<Credentials> {
  const oauth2Client = getOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to obtain required tokens from Google")
  }

  return tokens
}

/**
 * Store OAuth tokens in the database (encrypted).
 */
export async function storeTokens(
  email: string,
  tokens: Credentials
): Promise<void> {
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Both access_token and refresh_token are required")
  }

  const accessTokenEncrypted = encryptToken(tokens.access_token)
  const refreshTokenEncrypted = encryptToken(tokens.refresh_token)
  const tokenExpiry = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString()

  await query(
    `INSERT INTO gmail_oauth_tokens (
      user_email,
      access_token_encrypted,
      refresh_token_encrypted,
      token_expiry,
      scopes,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_email)
    DO UPDATE SET
      access_token_encrypted = $2,
      refresh_token_encrypted = $3,
      token_expiry = $4,
      scopes = $5,
      updated_at = NOW()`,
    [email, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiry, SCOPES]
  )
}

/**
 * Retrieve stored OAuth tokens for a user email.
 */
export async function getStoredTokens(
  email: string
): Promise<Credentials | null> {
  const row = await queryOne<GmailOAuthTokens>(
    `SELECT * FROM gmail_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  if (!row) {
    return null
  }

  return {
    access_token: decryptToken(row.access_token_encrypted),
    refresh_token: decryptToken(row.refresh_token_encrypted),
    expiry_date: new Date(row.token_expiry).getTime(),
    scope: row.scopes?.join(" "),
    token_type: "Bearer",
  }
}

/**
 * Check if a user has connected their Gmail account.
 */
export async function isGmailConnected(email: string): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM gmail_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  return row !== null && parseInt(row.count) > 0
}

/**
 * Get the connected Gmail info for display.
 */
export async function getGmailConnectionInfo(email: string): Promise<{
  isConnected: boolean
  userEmail: string | null
  connectedAt: string | null
  scopes: string[]
} | null> {
  const row = await queryOne<GmailOAuthTokens>(
    `SELECT user_email, scopes, created_at FROM gmail_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  if (!row) {
    return {
      isConnected: false,
      userEmail: null,
      connectedAt: null,
      scopes: [],
    }
  }

  return {
    isConnected: true,
    userEmail: row.user_email,
    connectedAt: row.created_at,
    scopes: row.scopes || [],
  }
}

/**
 * Revoke and delete stored tokens for a user.
 */
export async function revokeTokens(email: string): Promise<void> {
  const tokens = await getStoredTokens(email)

  if (tokens?.access_token) {
    try {
      const oauth2Client = getOAuth2Client()
      await oauth2Client.revokeToken(tokens.access_token)
    } catch (error) {
      // Log but don't fail - token might already be invalid
      console.warn("Failed to revoke token with Google:", error)
    }
  }

  await query(`DELETE FROM gmail_oauth_tokens WHERE user_email = $1`, [email])
}

/**
 * Refresh the access token if it's expired or about to expire.
 * Returns true if the token was refreshed.
 */
export async function refreshTokenIfNeeded(email: string): Promise<boolean> {
  const row = await queryOne<GmailOAuthTokens>(
    `SELECT * FROM gmail_oauth_tokens WHERE user_email = $1`,
    [email]
  )

  if (!row) {
    throw new Error(`No tokens found for ${email}`)
  }

  const expiryTime = new Date(row.token_expiry).getTime()
  const now = Date.now()

  // Refresh if token expires in less than 5 minutes
  if (expiryTime - now > 5 * 60 * 1000) {
    return false
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: decryptToken(row.refresh_token_encrypted),
  })

  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token")
  }

  // Update stored tokens
  const accessTokenEncrypted = encryptToken(credentials.access_token)
  const tokenExpiry = credentials.expiry_date
    ? new Date(credentials.expiry_date).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString()

  await query(
    `UPDATE gmail_oauth_tokens
     SET access_token_encrypted = $1, token_expiry = $2, updated_at = NOW()
     WHERE user_email = $3`,
    [accessTokenEncrypted, tokenExpiry, email]
  )

  return true
}
