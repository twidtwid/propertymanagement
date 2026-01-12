import { query } from '@/lib/db'
import { decryptToken } from '@/lib/encryption'

interface NestLegacyCredentials {
  access_token: string
  user_id?: string
  email?: string
  password?: string
  expires_at?: string
}

export async function getNestLegacyCredentials(): Promise<NestLegacyCredentials> {
  const rows = await query<{ credentials_encrypted: string }>(
    `SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest_legacy' LIMIT 1`
  )

  if (rows.length === 0) {
    throw new Error('Nest Legacy credentials not configured')
  }

  return JSON.parse(decryptToken(rows[0].credentials_encrypted))
}

export async function getValidNestLegacyToken(): Promise<string> {
  const credentials = await getNestLegacyCredentials()

  if (!credentials.access_token) {
    throw new Error('No access_token in Nest Legacy credentials')
  }

  // Check if token is expired or about to expire (within 24 hours)
  if (credentials.expires_at) {
    const expiresAt = new Date(credentials.expires_at as string).getTime()
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    if (expiresAt < now) {
      throw new Error('Nest Legacy token has expired. Please refresh the token manually.')
    }

    if (expiresAt < now + oneDay) {
      console.warn('[nest_legacy] Token expires in less than 24 hours! Please refresh soon.')
    }
  }

  return credentials.access_token
}
