#!/usr/bin/env node

/**
 * Test script for Nest OAuth token refresh
 * Tests the automatic token refresh logic without needing authentication
 */

const { Pool } = require('pg')
const crypto = require('crypto')

// Load environment (skip in Docker where env vars are already set)
try {
  require('dotenv').config({ path: '.env.local' })
} catch (e) {
  // dotenv not available, assume env vars are already set (Docker)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Encryption functions (copied from src/lib/encryption.ts)
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function decryptToken(encryptedBase64) {
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set')
  }
  if (!encryptedBase64) {
    throw new Error('No encrypted data provided')
  }

  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex')
  const combined = Buffer.from(encryptedBase64, 'base64')

  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

function encryptToken(plaintext) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const authTag = cipher.getAuthTag()

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag])

  return combined.toString('base64')
}

async function getNestCredentials() {
  const result = await pool.query(
    `SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest' LIMIT 1`
  )

  if (result.rows.length === 0) {
    throw new Error('Nest credentials not configured')
  }

  return JSON.parse(decryptToken(result.rows[0].credentials_encrypted))
}

async function refreshNestToken() {
  console.log('🔄 Starting token refresh...')
  const credentials = await getNestCredentials()

  console.log('📋 Current token expires at:', new Date(credentials.expires_at).toISOString())
  console.log('⏰ Current time:', new Date().toISOString())

  const expired = credentials.expires_at < Date.now()
  console.log(`🔍 Token ${expired ? 'IS' : 'is NOT'} expired`)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: credentials.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Token refresh failed:', error)
    throw new Error('Failed to refresh Nest OAuth token')
  }

  const data = await response.json()
  console.log('✅ Got new token from Google, expires in:', data.expires_in, 'seconds')

  // Update credentials in database
  const newCredentials = {
    access_token: data.access_token,
    refresh_token: credentials.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }

  const encrypted = encryptToken(JSON.stringify(newCredentials))

  await pool.query(
    `UPDATE camera_credentials
     SET credentials_encrypted = $1, updated_at = NOW()
     WHERE provider = 'nest'`,
    [encrypted]
  )

  console.log('✅ Nest OAuth token refreshed and saved to database')
  console.log('📅 New expiration:', new Date(newCredentials.expires_at).toISOString())

  return data.access_token
}

async function testStreamRequest(accessToken) {
  console.log('\n🎥 Testing Nest API with refreshed token...')

  // Get camera external_id
  const cameraResult = await pool.query(
    `SELECT external_id, name FROM cameras WHERE provider = 'nest' LIMIT 1`
  )

  if (cameraResult.rows.length === 0) {
    console.log('⚠️  No Nest cameras found in database')
    return
  }

  const camera = cameraResult.rows[0]
  console.log(`📹 Testing with camera: ${camera.name}`)

  const response = await fetch(
    `https://smartdevicemanagement.googleapis.com/v1/enterprises/${process.env.NEST_PROJECT_ID}/devices/${camera.external_id}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (response.ok) {
    console.log('✅ Nest API call successful! Token is working.')
    const data = await response.json()
    console.log('📡 Camera status:', data.traits?.['sdm.devices.traits.Connectivity']?.status)
  } else {
    console.log('❌ Nest API call failed:', response.status, response.statusText)
    const error = await response.text()
    console.log('Error details:', error)
  }
}

async function main() {
  try {
    console.log('🚀 Testing Nest OAuth Token Refresh\n')

    // Refresh the token
    const newAccessToken = await refreshNestToken()

    // Test the new token with a real API call
    await testStreamRequest(newAccessToken)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  } finally {
    await pool.end()
  }
}

main()
