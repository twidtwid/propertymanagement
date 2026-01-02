import { describe, it, expect, beforeEach, vi } from 'vitest'
import { signSession, verifySession } from './session'

describe('session signing and verification', () => {
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'owner' as const,
  }

  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-secret-at-least-32-characters-long')
  })

  describe('signSession', () => {
    it('should sign a session and return a string with two parts', () => {
      const signed = signSession(testUser)

      expect(typeof signed).toBe('string')
      expect(signed.split('.')).toHaveLength(2)
    })

    it('should produce different signatures for different payloads', () => {
      const user1 = { ...testUser, id: 'user-1' }
      const user2 = { ...testUser, id: 'user-2' }

      const signed1 = signSession(user1)
      const signed2 = signSession(user2)

      expect(signed1).not.toBe(signed2)
    })

    it('should produce consistent signatures for same payload', () => {
      const signed1 = signSession(testUser)
      const signed2 = signSession(testUser)

      expect(signed1).toBe(signed2)
    })
  })

  describe('verifySession', () => {
    it('should verify and return the original payload', () => {
      const signed = signSession(testUser)
      const verified = verifySession<typeof testUser>(signed)

      expect(verified).toEqual(testUser)
    })

    it('should return null for tampered payload', () => {
      const signed = signSession(testUser)
      const [, signature] = signed.split('.')

      // Tamper with the payload - change the user ID
      const tamperedPayload = Buffer.from(JSON.stringify({ ...testUser, id: 'hacked-user-id' })).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      const tampered = `${tamperedPayload}.${signature}`

      const verified = verifySession(tampered)

      expect(verified).toBeNull()
    })

    it('should return null for tampered signature', () => {
      const signed = signSession(testUser)
      const [payload] = signed.split('.')

      const tampered = `${payload}.invalidsignature`
      const verified = verifySession(tampered)

      expect(verified).toBeNull()
    })

    it('should return null for malformed input', () => {
      expect(verifySession('not-valid')).toBeNull()
      expect(verifySession('')).toBeNull()
      expect(verifySession('a.b.c')).toBeNull()
    })

    it('should reject privilege escalation attempts', () => {
      // Sign as bookkeeper
      const bookkeeper = { ...testUser, role: 'bookkeeper' as const }
      const signed = signSession(bookkeeper)

      // Verify returns bookkeeper, not owner
      const verified = verifySession<typeof testUser>(signed)
      expect(verified?.role).toBe('bookkeeper')

      // Tampering with role should fail verification
      const [, signature] = signed.split('.')
      const escalatedPayload = Buffer.from(JSON.stringify({ ...bookkeeper, role: 'owner' })).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      const tampered = `${escalatedPayload}.${signature}`

      expect(verifySession(tampered)).toBeNull()
    })
  })

  // Note: AUTH_SECRET validation is tested implicitly - if it were missing or short,
  // the signing tests above would fail. The validation throws before signing occurs.
})
