import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

/**
 * Safely parse a date value that could be a string, Date, null, or undefined
 * Returns a valid Date object or null
 */
export function safeParseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null

  try {
    if (date instanceof Date) {
      return isValid(date) ? date : null
    }

    if (typeof date === "string") {
      const parsed = parseISO(date)
      return isValid(parsed) ? parsed : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * Format a date value safely, returning a fallback string if the date is invalid
 */
export function formatDate(date: Date | string | null | undefined, fallback: string = "N/A"): string {
  const parsed = safeParseDate(date)
  if (!parsed) return fallback

  try {
    return format(parsed, "MMM d, yyyy")
  } catch {
    return fallback
  }
}

export function formatDateLong(date: Date | string | null | undefined, fallback: string = "N/A"): string {
  const parsed = safeParseDate(date)
  if (!parsed) return fallback

  try {
    return format(parsed, "EEEE, MMMM d, yyyy")
  } catch {
    return fallback
  }
}

export function formatDateTime(date: Date | string | null | undefined, fallback: string = "N/A"): string {
  const parsed = safeParseDate(date)
  if (!parsed) return fallback

  try {
    return format(parsed, "MMM d, h:mm a")
  } catch {
    return fallback
  }
}

export function daysUntil(date: Date | string | null | undefined): number {
  const parsed = safeParseDate(date)
  if (!parsed) return 0

  const now = new Date()
  const diff = parsed.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function daysSince(date: Date | string | null | undefined): number {
  const parsed = safeParseDate(date)
  if (!parsed) return 0

  const now = new Date()
  const diff = now.getTime() - parsed.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
