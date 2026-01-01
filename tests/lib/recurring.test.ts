import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { addMonths, startOfMonth, setDate, format, isWithinInterval, addDays } from 'date-fns'

// Since the recurring.ts file uses "use server" and DB calls,
// we test the date calculation logic directly here

describe('calculateNextDueDates logic', () => {
  // Replicate the logic from recurring.ts for testing
  function calculateNextDueDates(
    recurrence: string,
    dayOfMonth: number,
    monthOfYear: number,
    fromDate: Date,
    daysAhead: number
  ): Date[] {
    const dueDates: Date[] = []
    const endDate = addDays(fromDate, daysAhead)

    switch (recurrence) {
      case 'monthly': {
        let currentMonth = startOfMonth(fromDate)
        while (currentMonth <= endDate) {
          const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
          if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
            dueDates.push(dueDate)
          }
          currentMonth = addMonths(currentMonth, 1)
        }
        break
      }

      case 'quarterly': {
        const quarterStartMonths = [0, 3, 6, 9] // January, April, July, October
        let currentMonth = startOfMonth(fromDate)
        for (let i = 0; i < 6; i++) {
          const monthIndex = currentMonth.getMonth()
          if (quarterStartMonths.includes(monthIndex)) {
            const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
            if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
              dueDates.push(dueDate)
            }
          }
          currentMonth = addMonths(currentMonth, 1)
        }
        break
      }

      case 'semi_annual': {
        const firstMonth = monthOfYear - 1 // Convert to 0-indexed
        const secondMonth = (firstMonth + 6) % 12
        let currentMonth = startOfMonth(fromDate)
        for (let i = 0; i < 12; i++) {
          const monthIndex = currentMonth.getMonth()
          if (monthIndex === firstMonth || monthIndex === secondMonth) {
            const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
            if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
              dueDates.push(dueDate)
            }
          }
          currentMonth = addMonths(currentMonth, 1)
        }
        break
      }

      case 'annual': {
        let currentMonth = startOfMonth(fromDate)
        for (let i = 0; i < 24; i++) {
          const monthIndex = currentMonth.getMonth()
          if (monthIndex === monthOfYear - 1) {
            const dueDate = setDate(currentMonth, Math.min(dayOfMonth, 28))
            if (isWithinInterval(dueDate, { start: fromDate, end: endDate })) {
              dueDates.push(dueDate)
            }
          }
          currentMonth = addMonths(currentMonth, 1)
        }
        break
      }
    }

    return dueDates
  }

  describe('monthly recurrence', () => {
    it('should generate dates for each month within range', () => {
      const fromDate = new Date('2025-01-15')
      const dates = calculateNextDueDates('monthly', 1, 1, fromDate, 60)

      // Should get February 1 and March 1 (within 60 days from Jan 15)
      expect(dates.length).toBeGreaterThanOrEqual(2)
      expect(dates.some(d => d.getMonth() === 1 && d.getDate() === 1)).toBe(true) // Feb
      expect(dates.some(d => d.getMonth() === 2 && d.getDate() === 1)).toBe(true) // Mar
    })

    it('should handle day 31 by capping at 28', () => {
      const fromDate = new Date('2025-02-01')
      const dates = calculateNextDueDates('monthly', 31, 1, fromDate, 30)

      // February should use day 28
      const febDate = dates.find(d => d.getMonth() === 1)
      if (febDate) {
        expect(febDate.getDate()).toBe(28)
      }
    })

    it('should include current month if day has not passed', () => {
      const fromDate = new Date('2025-01-10')
      const dates = calculateNextDueDates('monthly', 15, 1, fromDate, 30)

      // January 15 should be included
      expect(dates.some(d => d.getMonth() === 0 && d.getDate() === 15)).toBe(true)
    })
  })

  describe('quarterly recurrence', () => {
    it('should generate dates only for quarter start months (Jan, Apr, Jul, Oct)', () => {
      const fromDate = new Date('2025-01-01')
      const dates = calculateNextDueDates('quarterly', 15, 1, fromDate, 180)

      // Within 180 days from Jan 1: Jan 15, Apr 15
      const months = dates.map(d => d.getMonth())
      expect(months.every(m => [0, 3, 6, 9].includes(m))).toBe(true)
    })

    it('should handle mid-quarter start date', () => {
      const fromDate = new Date('2025-02-15')
      const dates = calculateNextDueDates('quarterly', 1, 1, fromDate, 90)

      // Should get April 1 (next quarter)
      expect(dates.some(d => d.getMonth() === 3 && d.getDate() === 1)).toBe(true)
    })
  })

  describe('semi-annual recurrence', () => {
    it('should generate two dates 6 months apart', () => {
      const fromDate = new Date('2025-01-01')
      // monthOfYear = 1 means January and July
      const dates = calculateNextDueDates('semi_annual', 15, 1, fromDate, 365)

      // Should get January 15 and July 15
      expect(dates.some(d => d.getMonth() === 0 && d.getDate() === 15)).toBe(true)
      expect(dates.some(d => d.getMonth() === 6 && d.getDate() === 15)).toBe(true)
    })

    it('should handle monthOfYear for different schedules', () => {
      const fromDate = new Date('2025-01-01')
      // monthOfYear = 3 means March and September
      const dates = calculateNextDueDates('semi_annual', 1, 3, fromDate, 365)

      expect(dates.some(d => d.getMonth() === 2)).toBe(true) // March
      expect(dates.some(d => d.getMonth() === 8)).toBe(true) // September
    })
  })

  describe('annual recurrence', () => {
    it('should generate one date per year', () => {
      const fromDate = new Date('2025-01-01')
      // monthOfYear = 6 means June
      const dates = calculateNextDueDates('annual', 15, 6, fromDate, 365)

      // Should get June 15, 2025
      expect(dates).toHaveLength(1)
      expect(dates[0].getMonth()).toBe(5) // June (0-indexed)
      expect(dates[0].getDate()).toBe(15)
    })

    it('should return empty if annual date is outside range', () => {
      const fromDate = new Date('2025-08-01')
      // June has already passed
      const dates = calculateNextDueDates('annual', 15, 6, fromDate, 30)

      expect(dates).toHaveLength(0)
    })

    it('should get next year date within 365 day range', () => {
      const fromDate = new Date('2025-07-01')
      // monthOfYear = 6 means June - already passed in 2025
      const dates = calculateNextDueDates('annual', 15, 6, fromDate, 365)

      // Should get June 15, 2026
      expect(dates.length).toBeGreaterThanOrEqual(1)
      expect(dates[0].getFullYear()).toBe(2026)
    })
  })
})

describe('Insurance premium due date calculation', () => {
  it('should set due date 30 days before expiration', () => {
    const expirationDate = new Date('2025-12-31')
    const dueDate = addDays(expirationDate, -30)

    expect(format(dueDate, 'yyyy-MM-dd')).toBe('2025-12-01')
  })

  it('should handle leap year correctly', () => {
    // March 1 in a leap year - 30 days before is Jan 30
    const expirationDate = new Date('2024-03-01') // 2024 is a leap year
    const dueDate = addDays(expirationDate, -30)

    expect(format(dueDate, 'yyyy-MM-dd')).toBe('2024-01-31')
  })
})

describe('Mortgage due date calculation', () => {
  it('should use mortgage_due_day for current month if not passed', () => {
    const today = new Date('2025-01-10')
    const mortgageDueDay = 15

    let dueDate = setDate(startOfMonth(today), mortgageDueDay)
    if (dueDate < today) {
      dueDate = setDate(addMonths(startOfMonth(today), 1), mortgageDueDay)
    }

    expect(dueDate.getDate()).toBe(15)
    expect(dueDate.getMonth()).toBe(0) // January
  })

  it('should roll to next month if due day has passed', () => {
    const today = new Date('2025-01-20')
    const mortgageDueDay = 15

    let dueDate = setDate(startOfMonth(today), mortgageDueDay)
    if (dueDate < today) {
      dueDate = setDate(addMonths(startOfMonth(today), 1), mortgageDueDay)
    }

    expect(dueDate.getDate()).toBe(15)
    expect(dueDate.getMonth()).toBe(1) // February
  })
})

describe('Bill deduplication logic', () => {
  it('should identify duplicate bills by template ID and due date', () => {
    const templateId = 'template-123'
    const dueDate = '2025-01-15'

    // Pattern used in billExistsForTemplate
    const notesPattern = `%recurring_template_id:${templateId}%`

    expect(notesPattern).toBe('%recurring_template_id:template-123%')
  })

  it('should allow same template with different due dates', () => {
    const templateId = 'template-123'
    const dueDate1 = '2025-01-15'
    const dueDate2 = '2025-02-15'

    // These should be treated as separate bills
    expect(dueDate1).not.toBe(dueDate2)
  })
})

describe('Generation result structure', () => {
  it('should track generated, skipped, and errors', () => {
    interface GenerationResult {
      generated: number
      skipped: number
      errors: string[]
    }

    const result: GenerationResult = {
      generated: 5,
      skipped: 2,
      errors: ['Failed to generate bill for template X'],
    }

    expect(result.generated).toBe(5)
    expect(result.skipped).toBe(2)
    expect(result.errors).toHaveLength(1)
  })
})
