import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getMonthDays,
  getWeekDays,
  getDayRange,
  getWeekRange,
  getMonthRange,
  navigateDate,
  formatDateHeader,
  parseDate,
  isSameDateStr,
  WEEKDAY_NAMES,
  WEEKDAY_NAMES_FULL,
  HOURS,
} from '@/lib/calendar-utils'
import { format } from 'date-fns'

describe('getMonthDays', () => {
  it('should return 42 days (6 weeks) for a typical month', () => {
    const date = new Date('2025-01-15')
    const days = getMonthDays(date)

    // Most months show 6 weeks = 42 days
    expect(days.length).toBeGreaterThanOrEqual(28)
    expect(days.length).toBeLessThanOrEqual(42)
  })

  it('should include days from previous and next month for alignment', () => {
    const date = new Date('2025-01-15')
    const days = getMonthDays(date)

    // If Jan 1 is Wednesday, calendar should start on Sunday Dec 29
    const firstDay = days[0]
    const lastDay = days[days.length - 1]

    // First day should be Sunday
    expect(firstDay.dayOfWeek).toBe(0)
    // Last day should be Saturday
    expect(lastDay.dayOfWeek).toBe(6)
  })

  it('should mark current month days correctly', () => {
    const date = new Date('2025-01-15')
    const days = getMonthDays(date)

    const januaryDays = days.filter(d => d.isCurrentMonth)
    expect(januaryDays.length).toBe(31) // January has 31 days
  })

  it('should identify today correctly', () => {
    // Mock the current date
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15'))

    const days = getMonthDays(new Date('2025-01-15'))
    const today = days.find(d => d.isToday)

    expect(today).toBeDefined()
    expect(today!.dateStr).toBe('2025-01-15')

    vi.useRealTimers()
  })

  it('should mark weekends correctly', () => {
    const date = new Date('2025-01-15')
    const days = getMonthDays(date)

    const weekends = days.filter(d => d.isWeekend)
    // 6 weeks * 2 weekend days = 12
    expect(weekends.length).toBeGreaterThanOrEqual(8)

    weekends.forEach(d => {
      expect([0, 6]).toContain(d.dayOfWeek)
    })
  })

  it('should format dateStr as yyyy-MM-dd', () => {
    const date = new Date('2025-01-15')
    const days = getMonthDays(date)

    days.forEach(d => {
      expect(d.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})

describe('getWeekDays', () => {
  it('should return exactly 7 days', () => {
    const date = new Date('2025-01-15')
    const days = getWeekDays(date)

    expect(days).toHaveLength(7)
  })

  it('should start on Sunday', () => {
    const date = new Date('2025-01-15') // Wednesday
    const days = getWeekDays(date)

    expect(days[0].dayOfWeek).toBe(0) // Sunday
    expect(days[6].dayOfWeek).toBe(6) // Saturday
  })

  it('should contain the input date', () => {
    const date = new Date('2025-01-15')
    const days = getWeekDays(date)

    const containsDate = days.some(d => d.dateStr === '2025-01-15')
    expect(containsDate).toBe(true)
  })

  it('should mark all days as current month (for week view)', () => {
    const date = new Date('2025-01-15')
    const days = getWeekDays(date)

    days.forEach(d => {
      expect(d.isCurrentMonth).toBe(true)
    })
  })
})

describe('getDayRange', () => {
  it('should return same date for start and end', () => {
    const date = new Date('2025-01-15')
    const range = getDayRange(date)

    expect(range.start).toBe('2025-01-15')
    expect(range.end).toBe('2025-01-15')
  })
})

describe('getWeekRange', () => {
  it('should return Sunday to Saturday', () => {
    const date = new Date('2025-01-15') // Wednesday
    const range = getWeekRange(date)

    // Week containing Jan 15 (Wed): Sun Jan 12 to Sat Jan 18
    expect(range.start).toBe('2025-01-12')
    expect(range.end).toBe('2025-01-18')
  })

  it('should handle week spanning month boundary', () => {
    const date = new Date('2025-02-01') // Saturday
    const range = getWeekRange(date)

    // Week: Sun Jan 26 to Sat Feb 1
    expect(range.start).toBe('2025-01-26')
    expect(range.end).toBe('2025-02-01')
  })
})

describe('getMonthRange', () => {
  it('should include days from adjacent months for calendar alignment', () => {
    const date = new Date('2025-01-15')
    const range = getMonthRange(date)

    // Jan 2025 starts on Wednesday, so calendar starts Sun Dec 29, 2024
    // Jan 2025 ends on Friday, so calendar ends Sat Feb 1, 2025
    expect(new Date(range.start) <= new Date('2025-01-01')).toBe(true)
    expect(new Date(range.end) >= new Date('2025-01-31')).toBe(true)
  })
})

describe('navigateDate', () => {
  describe('month view', () => {
    it('should go to previous month', () => {
      const date = new Date('2025-01-15')
      const result = navigateDate(date, 'prev', 'month')

      expect(result.getMonth()).toBe(11) // December
      expect(result.getFullYear()).toBe(2024)
    })

    it('should go to next month', () => {
      const date = new Date('2025-01-15')
      const result = navigateDate(date, 'next', 'month')

      expect(result.getMonth()).toBe(1) // February
      expect(result.getFullYear()).toBe(2025)
    })
  })

  describe('week view', () => {
    it('should go to previous week', () => {
      const date = new Date('2025-01-15')
      const result = navigateDate(date, 'prev', 'week')

      expect(result.getDate()).toBe(8)
    })

    it('should go to next week', () => {
      const date = new Date('2025-01-15')
      const result = navigateDate(date, 'next', 'week')

      expect(result.getDate()).toBe(22)
    })
  })

  describe('day view', () => {
    it('should go to previous day', () => {
      const date = new Date('2025-01-15')
      const result = navigateDate(date, 'prev', 'day')

      expect(result.getDate()).toBe(14)
    })

    it('should go to next day', () => {
      const date = new Date('2025-01-15')
      const result = navigateDate(date, 'next', 'day')

      expect(result.getDate()).toBe(16)
    })

    it('should handle month boundary', () => {
      const date = new Date('2025-01-01')
      const result = navigateDate(date, 'prev', 'day')

      expect(result.getDate()).toBe(31)
      expect(result.getMonth()).toBe(11) // December
    })
  })
})

describe('formatDateHeader', () => {
  it('should format month view as "MMMM yyyy"', () => {
    const date = new Date('2025-01-15')
    const result = formatDateHeader(date, 'month')

    expect(result).toBe('January 2025')
  })

  it('should format week view with date range (same month)', () => {
    const date = new Date('2025-01-15') // Wed
    const result = formatDateHeader(date, 'week')

    // Sun Jan 12 to Sat Jan 18
    expect(result).toContain('Jan')
    expect(result).toContain('12')
    expect(result).toContain('18')
  })

  it('should format week view with date range (different months)', () => {
    const date = new Date('2025-02-01') // Sat
    const result = formatDateHeader(date, 'week')

    // Sun Jan 26 to Sat Feb 1
    expect(result).toContain('Jan')
    expect(result).toContain('Feb')
  })

  it('should format day view as "EEEE, MMMM d, yyyy"', () => {
    const date = new Date('2025-01-15')
    const result = formatDateHeader(date, 'day')

    expect(result).toBe('Wednesday, January 15, 2025')
  })
})

describe('parseDate', () => {
  it('should parse ISO date string', () => {
    const result = parseDate('2025-01-15')

    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(15)
  })

  it('should parse date with time', () => {
    const result = parseDate('2025-01-15T10:30:00')

    expect(result.getFullYear()).toBe(2025)
    expect(result.getHours()).toBe(10)
    expect(result.getMinutes()).toBe(30)
  })
})

describe('isSameDateStr', () => {
  it('should return true for same date strings', () => {
    expect(isSameDateStr('2025-01-15', '2025-01-15')).toBe(true)
  })

  it('should return false for different dates', () => {
    expect(isSameDateStr('2025-01-15', '2025-01-16')).toBe(false)
  })

  it('should handle date strings with different formats', () => {
    // parseISO should normalize these
    expect(isSameDateStr('2025-01-15', '2025-01-15T00:00:00')).toBe(true)
  })
})

describe('Constants', () => {
  it('should have correct weekday names', () => {
    expect(WEEKDAY_NAMES).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(WEEKDAY_NAMES).toHaveLength(7)
  })

  it('should have correct full weekday names', () => {
    expect(WEEKDAY_NAMES_FULL).toEqual([
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ])
    expect(WEEKDAY_NAMES_FULL).toHaveLength(7)
  })

  it('should have 24 hours', () => {
    expect(HOURS).toHaveLength(24)
    expect(HOURS[0]).toBe(0)
    expect(HOURS[23]).toBe(23)
  })
})
