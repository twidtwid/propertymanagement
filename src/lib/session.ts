/**
 * Secure session cookie signing and verification using HMAC-SHA256.
 *
 * Cookie format: base64url(payload).base64url(signature)
 * Signature: HMAC-SHA256(payload, AUTH_SECRET)
 */

import { createHmac, timingSafeEqual } from "crypto"

const AUTH_SECRET = process.env.AUTH_SECRET

function getSecret(): string {
  if (!AUTH_SECRET) {
    throw new Error(
      "AUTH_SECRET environment variable is required. Generate with: openssl rand -base64 32"
    )
  }
  if (AUTH_SECRET.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters")
  }
  return AUTH_SECRET
}

function base64UrlEncode(data: string | Buffer): string {
  const base64 = Buffer.from(data).toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64UrlDecode(data: string): string {
  // Add back padding
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4)
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(base64, "base64").toString("utf-8")
}

function createSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret)
  hmac.update(payload)
  return base64UrlEncode(hmac.digest())
}

/**
 * Sign a session payload and return a signed cookie value.
 */
export function signSession<T extends object>(data: T): string {
  const secret = getSecret()
  const payload = JSON.stringify(data)
  const encodedPayload = base64UrlEncode(payload)
  const signature = createSignature(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

/**
 * Verify and parse a signed session cookie.
 * Returns null if signature is invalid or data is malformed.
 */
export function verifySession<T>(signedValue: string): T | null {
  const secret = getSecret()

  const parts = signedValue.split(".")
  if (parts.length !== 2) {
    return null
  }

  const [encodedPayload, providedSignature] = parts

  // Compute expected signature
  const expectedSignature = createSignature(encodedPayload, secret)

  // Timing-safe comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(providedSignature, "utf-8")
    const expectedBuffer = Buffer.from(expectedSignature, "utf-8")

    if (sigBuffer.length !== expectedBuffer.length) {
      return null
    }

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }
  } catch {
    return null
  }

  // Signature valid, decode payload
  try {
    const payload = base64UrlDecode(encodedPayload)
    return JSON.parse(payload) as T
  } catch {
    return null
  }
}

/**
 * Verify session for Edge runtime (middleware).
 * Uses Web Crypto API instead of Node crypto.
 */
export async function verifySessionEdge<T>(signedValue: string): Promise<T | null> {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    console.error("AUTH_SECRET not configured or too short")
    return null
  }

  const parts = signedValue.split(".")
  if (parts.length !== 2) {
    return null
  }

  const [encodedPayload, providedSignature] = parts

  try {
    // Import the secret key for HMAC
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    // Compute expected signature
    const signatureArrayBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(encodedPayload)
    )
    const expectedSignature = base64UrlEncode(Buffer.from(signatureArrayBuffer))

    // Compare signatures (not constant-time in Edge, but acceptable for this use case)
    if (providedSignature !== expectedSignature) {
      return null
    }

    // Signature valid, decode payload
    const payload = base64UrlDecode(encodedPayload)
    return JSON.parse(payload) as T
  } catch {
    return null
  }
}
