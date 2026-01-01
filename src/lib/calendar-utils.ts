import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  getDay,
  parseISO,
} from "date-fns"

export type CalendarViewType = "month" | "week" | "day"

export interface CalendarDay {
  date: Date
  dateStr: string
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  dayOfWeek: number
}

export function getMonthDays(date: Date): CalendarDay[] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  return days.map((day) => ({
    date: day,
    dateStr: format(day, "yyyy-MM-dd"),
    isCurrentMonth: isSameMonth(day, date),
    isToday: isToday(day),
    isWeekend: getDay(day) === 0 || getDay(day) === 6,
    dayOfWeek: getDay(day),
  }))
}

export function getWeekDays(date: Date): CalendarDay[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 })

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  return days.map((day) => ({
    date: day,
    dateStr: format(day, "yyyy-MM-dd"),
    isCurrentMonth: true,
    isToday: isToday(day),
    isWeekend: getDay(day) === 0 || getDay(day) === 6,
    dayOfWeek: getDay(day),
  }))
}

export function getDayRange(date: Date): { start: string; end: string } {
  return {
    start: format(startOfDay(date), "yyyy-MM-dd"),
    end: format(endOfDay(date), "yyyy-MM-dd"),
  }
}

export function getWeekRange(date: Date): { start: string; end: string } {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
  return {
    start: format(weekStart, "yyyy-MM-dd"),
    end: format(weekEnd, "yyyy-MM-dd"),
  }
}

export function getMonthRange(date: Date): { start: string; end: string } {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  return {
    start: format(calendarStart, "yyyy-MM-dd"),
    end: format(calendarEnd, "yyyy-MM-dd"),
  }
}

export function navigateDate(
  date: Date,
  direction: "prev" | "next",
  view: CalendarViewType
): Date {
  switch (view) {
    case "month":
      return direction === "prev" ? subMonths(date, 1) : addMonths(date, 1)
    case "week":
      return direction === "prev" ? subWeeks(date, 1) : addWeeks(date, 1)
    case "day":
      return direction === "prev" ? subDays(date, 1) : addDays(date, 1)
  }
}

export function formatDateHeader(date: Date, view: CalendarViewType): string {
  switch (view) {
    case "month":
      return format(date, "MMMM yyyy")
    case "week":
      const weekStart = startOfWeek(date, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "d, yyyy")}`
      }
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
    case "day":
      return format(date, "EEEE, MMMM d, yyyy")
  }
}

export function parseDate(dateStr: string): Date {
  return parseISO(dateStr)
}

export function isSameDateStr(date1: string, date2: string): boolean {
  return isSameDay(parseISO(date1), parseISO(date2))
}

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export const WEEKDAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export const HOURS = Array.from({ length: 24 }, (_, i) => i)
