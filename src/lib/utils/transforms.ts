/**
 * Data Transformation Utilities
 *
 * Centralized helpers for common data transformations used throughout the app.
 * Consolidates duplicate patterns to reduce code duplication and improve maintainability.
 */

/**
 * Converts empty strings and undefined values to null.
 * Used extensively in database mutations to normalize empty form fields.
 *
 * @example
 * emptyToNull("") // null
 * emptyToNull(undefined) // null
 * emptyToNull("hello") // "hello"
 * emptyToNull(123) // 123
 */
export function emptyToNull<T>(value: T): T | null {
  if (value === "" || value === undefined) return null
  return value
}

/**
 * Omits properties with empty/null/undefined values from an object.
 * Useful for cleaning up form data before database insertion.
 *
 * @example
 * omitEmpty({ name: "John", email: "", age: null })
 * // Returns: { name: "John" }
 */
export function omitEmpty<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined && v !== "")
  ) as Partial<T>
}

/**
 * Converts null values back to empty strings.
 * Useful for populating form fields from database records.
 *
 * @example
 * nullToEmpty(null) // ""
 * nullToEmpty("hello") // "hello"
 */
export function nullToEmpty<T>(value: T | null | undefined): T | "" {
  if (value === null || value === undefined) return ""
  return value
}

/**
 * Parses a string value to a number, returning null if invalid.
 * Safer than parseInt/parseFloat for database fields.
 *
 * @example
 * parseNumberOrNull("123") // 123
 * parseNumberOrNull("") // null
 * parseNumberOrNull("abc") // null
 */
export function parseNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const num = typeof value === "number" ? value : parseFloat(value)
  return isNaN(num) ? null : num
}

/**
 * Safely trims a string, returning null if empty after trimming.
 *
 * @example
 * trimOrNull("  hello  ") // "hello"
 * trimOrNull("   ") // null
 * trimOrNull("") // null
 */
export function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}
