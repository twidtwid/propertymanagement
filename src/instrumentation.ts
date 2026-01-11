/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Perfect for validating environment variables before any requests are processed.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env')

    try {
      validateEnv()
      console.log('✅ Environment variables validated successfully')
    } catch (error) {
      // Error already logged by validateEnv()
      // Exit with error code to prevent startup with invalid config
      process.exit(1)
    }
  }
}
