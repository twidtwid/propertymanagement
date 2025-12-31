import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const TAG_LENGTH = 16

/**
 * Get the encryption key from environment variables.
 * The key should be a 32-byte (64 hex character) string.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is not set")
  }
  if (key.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)")
  }
  return Buffer.from(key, "hex")
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns a base64-encoded string containing: IV + ciphertext + auth tag
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, "utf8")
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const authTag = cipher.getAuthTag()

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag])

  return combined.toString("base64")
}

/**
 * Decrypt a string that was encrypted with encryptToken.
 * Expects a base64-encoded string containing: IV + ciphertext + auth tag
 */
export function decryptToken(encryptedBase64: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedBase64, "base64")

  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString("utf8")
}

/**
 * Generate a new random encryption key.
 * Use this to generate a TOKEN_ENCRYPTION_KEY for .env
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex")
}
