/**
 * Environment Variable Validation
 *
 * Validates all required environment variables on startup to fail fast
 * with clear error messages instead of runtime failures.
 */

import { z } from 'zod'

const envSchema = z.object({
  // Core Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Authentication & Security
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32, 'TOKEN_ENCRYPTION_KEY must be at least 32 characters'),
  COOKIE_SECURE: z.string().optional(),

  // Cron & Background Jobs
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),

  // OAuth Providers
  DROPBOX_APP_KEY: z.string().optional(),
  DROPBOX_APP_SECRET: z.string().optional(),
  DROPBOX_REDIRECT_URI: z.string().url().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // External APIs
  METEO_FRANCE_API_KEY: z.string().optional(),

  // Notifications
  PUSHOVER_TOKEN: z.string().optional(),
  PUSHOVER_USER_ANNE: z.string().optional(),
  PUSHOVER_USER_TODD: z.string().optional(),
  PUSHOVER_USER_AMELIA: z.string().optional(),
  NOTIFICATION_EMAIL: z.string().email().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type Env = z.infer<typeof envSchema>

let validatedEnv: Env | null = null

/**
 * Validates environment variables and caches the result.
 * Call this once at application startup (in instrumentation.ts or layout.tsx).
 *
 * @throws {Error} If validation fails with detailed error messages
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv
  }

  try {
    validatedEnv = envSchema.parse(process.env)
    return validatedEnv
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(err => {
        const path = err.path.join('.')
        return `  ❌ ${path}: ${err.message}`
      }).join('\n')

      console.error('\n' + '='.repeat(60))
      console.error('❌ ENVIRONMENT VARIABLE VALIDATION FAILED')
      console.error('='.repeat(60))
      console.error('\nThe following environment variables are invalid or missing:\n')
      console.error(missing)
      console.error('\n' + '='.repeat(60))
      console.error('Fix these issues in your .env.local or environment configuration.')
      console.error('='.repeat(60) + '\n')
    }

    throw new Error('Environment variable validation failed. See errors above.')
  }
}

/**
 * Gets a validated environment variable.
 * Must call validateEnv() first at application startup.
 *
 * @param key - The environment variable key
 * @returns The validated value
 * @throws {Error} If validateEnv() hasn't been called yet
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  if (!validatedEnv) {
    throw new Error('Environment not validated. Call validateEnv() first.')
  }
  return validatedEnv[key]
}

/**
 * Type-safe helper to check if we're in production
 */
export function isProduction(): boolean {
  return getEnv('NODE_ENV') === 'production'
}

/**
 * Type-safe helper to check if we're in development
 */
export function isDevelopment(): boolean {
  return getEnv('NODE_ENV') === 'development'
}
