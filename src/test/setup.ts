import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables for tests
process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))
