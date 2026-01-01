import '@testing-library/jest-dom'

// Mock the database module for unit tests
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}))
