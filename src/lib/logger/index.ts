/**
 * Core Logger Module
 *
 * Provides structured logging with console fallback.
 * Uses console.log for compatibility with Next.js edge runtime.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogFn {
  (obj: object, msg?: string): void
  (msg: string): void
}

export interface Logger {
  trace: LogFn
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn
  fatal: LogFn
  child: (bindings: object) => Logger
}

const isDev = process.env.NODE_ENV !== 'production'
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')

const levels: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

const currentLevel = levels[logLevel as LogLevel] || levels.info

// Sensitive fields to redact
const sensitiveFields = new Set([
  'password', 'token', 'accessToken', 'refreshToken',
  'TOKEN_ENCRYPTION_KEY', 'authorization', 'cookie'
])

function redact(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.has(key.toLowerCase())) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value)
    } else {
      result[key] = value
    }
  }
  return result
}

function createLogFn(level: LogLevel, bindings: object): LogFn {
  const levelNum = levels[level]
  const consoleFn = level === 'error' || level === 'fatal' ? console.error
    : level === 'warn' ? console.warn
    : level === 'debug' || level === 'trace' ? console.debug
    : console.log

  return (objOrMsg: object | string, msg?: string) => {
    if (levelNum < currentLevel) return

    const timestamp = new Date().toISOString()
    let logObj: object
    let message: string

    if (typeof objOrMsg === 'string') {
      message = objOrMsg
      logObj = {}
    } else {
      message = msg || ''
      logObj = objOrMsg
    }

    const output = {
      level,
      time: timestamp,
      ...bindings,
      ...redact(logObj) as object,
      msg: message,
    }

    if (isDev) {
      // Pretty print in dev
      const prefix = `[${timestamp.split('T')[1].split('.')[0]}] ${level.toUpperCase().padEnd(5)}`
      const details = Object.keys(logObj).length > 0 ? ` ${JSON.stringify(redact(logObj))}` : ''
      consoleFn(`${prefix} ${message}${details}`)
    } else {
      // JSON in production
      consoleFn(JSON.stringify(output))
    }
  }
}

function createLoggerInstance(bindings: object = {}): Logger {
  return {
    trace: createLogFn('trace', bindings),
    debug: createLogFn('debug', bindings),
    info: createLogFn('info', bindings),
    warn: createLogFn('warn', bindings),
    error: createLogFn('error', bindings),
    fatal: createLogFn('fatal', bindings),
    child: (childBindings: object) => createLoggerInstance({ ...bindings, ...childBindings }),
  }
}

export const logger = createLoggerInstance({
  app: 'property-management',
  env: process.env.NODE_ENV || 'development',
})

/**
 * Create a child logger with module context
 */
export function createLogger(module: string): Logger {
  return logger.child({ module })
}
