import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, formatCurrency, formatDate, formatDateLong, daysUntil, daysSince } from '@/lib/utils'

describe('cn (className merger)', () => {
  it('should merge class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')
    expect(result).toBe('base active')
  })

  it('should filter out falsy values', () => {
    const result = cn('base', false && 'hidden', null, undefined, 'visible')
    expect(result).toBe('base visible')
  })

  it('should merge Tailwind classes correctly', () => {
    // tailwind-merge should handle conflicting utilities
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4') // Later value wins
  })

  it('should handle arrays', () => {
    const result = cn(['foo', 'bar'], 'baz')
    expect(result).toBe('foo bar baz')
  })

  it('should handle objects', () => {
    const result = cn({
      foo: true,
      bar: false,
      baz: true,
    })
    expect(result).toBe('foo baz')
  })
})

describe('formatCurrency', () => {
  it('should format USD by default', () => {
    const result = formatCurrency(1234.56)
    expect(result).toBe('$1,234.56')
  })

  it('should format different currencies', () => {
    const eur = formatCurrency(1234.56, 'EUR')
    expect(eur).toContain('1,234.56')
    // EUR symbol may appear before or after depending on locale
  })

  it('should handle zero', () => {
    const result = formatCurrency(0)
    expect(result).toBe('$0.00')
  })

  it('should handle negative amounts', () => {
    const result = formatCurrency(-500)
    expect(result).toContain('500.00')
    // Negative sign may vary by locale
  })

  it('should handle large amounts', () => {
    const result = formatCurrency(1000000)
    expect(result).toBe('$1,000,000.00')
  })

  it('should round to 2 decimal places', () => {
    const result = formatCurrency(123.456)
    expect(result).toBe('$123.46')
  })
})

describe('formatDate', () => {
  it('should format Date object', () => {
    const date = new Date('2025-01-15')
    const result = formatDate(date)

    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2025')
  })

  it('should format date string', () => {
    const result = formatDate('2025-01-15')

    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2025')
  })

  it('should use short month format', () => {
    const result = formatDate('2025-12-25')

    expect(result).toContain('Dec')
    expect(result).not.toContain('December')
  })
})

describe('formatDateLong', () => {
  it('should include weekday', () => {
    const date = new Date('2025-01-15') // Wednesday
    const result = formatDateLong(date)

    expect(result).toContain('Wednesday')
  })

  it('should use long month format', () => {
    const result = formatDateLong('2025-01-15')

    expect(result).toContain('January')
    // Note: "January" contains "Jan" as a substring, so we check for full month name
    expect(result).toMatch(/January/)
  })

  it('should include year', () => {
    const result = formatDateLong('2025-01-15')

    expect(result).toContain('2025')
  })
})

describe('daysUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return positive days for future dates', () => {
    const futureDate = '2025-01-25'
    const result = daysUntil(futureDate)

    expect(result).toBe(10)
  })

  it('should return 1 or less for today (uses ceil)', () => {
    // daysUntil uses Math.ceil, so end of today returns 1
    const today = new Date('2025-01-15T23:59:59')
    const result = daysUntil(today)

    expect(result).toBeLessThanOrEqual(1)
  })

  it('should return negative days for past dates', () => {
    const pastDate = '2025-01-10'
    const result = daysUntil(pastDate)

    expect(result).toBeLessThan(0)
  })

  it('should work with Date objects', () => {
    const futureDate = new Date('2025-01-20')
    const result = daysUntil(futureDate)

    expect(result).toBeGreaterThan(0)
  })

  it('should handle date strings', () => {
    const result = daysUntil('2025-01-20')

    expect(result).toBeGreaterThan(0)
  })
})

describe('daysSince', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return positive days for past dates', () => {
    const pastDate = '2025-01-05'
    const result = daysSince(pastDate)

    expect(result).toBe(10)
  })

  it('should return 0 for today', () => {
    const today = new Date('2025-01-15T00:00:00')
    const result = daysSince(today)

    expect(result).toBe(0)
  })

  it('should return negative days for future dates', () => {
    const futureDate = '2025-01-25'
    const result = daysSince(futureDate)

    expect(result).toBeLessThan(0)
  })

  it('should work with Date objects', () => {
    const pastDate = new Date('2025-01-01')
    const result = daysSince(pastDate)

    expect(result).toBeGreaterThan(0)
  })

  it('should handle date strings', () => {
    const result = daysSince('2025-01-01')

    expect(result).toBeGreaterThan(0)
  })

  it('should have opposite signs for daysUntil and daysSince', () => {
    const date = '2025-01-20'
    const until = daysUntil(date)
    const since = daysSince(date)

    // daysUntil uses ceil, daysSince uses floor
    // For a future date: until is positive, since is negative
    expect(until).toBeGreaterThan(0)
    expect(since).toBeLessThan(0)
  })
})

describe('Edge cases', () => {
  describe('formatCurrency edge cases', () => {
    it('should handle very small amounts', () => {
      const result = formatCurrency(0.01)
      expect(result).toBe('$0.01')
    })

    it('should handle fractional cents', () => {
      const result = formatCurrency(0.001)
      expect(result).toBe('$0.00')
    })
  })

  describe('date edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should handle leap year dates', () => {
      vi.setSystemTime(new Date('2024-02-28'))
      const result = daysUntil('2024-02-29')
      expect(result).toBe(1)
    })

    it('should handle year boundary', () => {
      vi.setSystemTime(new Date('2024-12-31'))
      const result = daysUntil('2025-01-01')
      expect(result).toBe(1)
    })

    it('should handle daylight saving time transition', () => {
      // March 9, 2025 is DST start in US
      vi.setSystemTime(new Date('2025-03-08'))
      const result = daysUntil('2025-03-10')
      expect(result).toBe(2)
    })
  })
})
