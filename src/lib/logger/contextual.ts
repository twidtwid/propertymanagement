/**
 * Contextual Logger
 *
 * Provides a logger that automatically includes request context.
 * Use getLogger() in any function to get a context-aware logger.
 */

import { logger, createLogger, type Logger, type LogLevel } from './index'
import { getRequestContext } from './context'

/**
 * Flexible logger interface that accepts both argument orders:
 * - log.info("message", { data }) - common pattern
 * - log.info({ data }, "message") - native pattern
 */
type FlexibleLogFn = (msgOrObj: string | object, dataOrMsg?: object | string) => void

type FlexibleLogger = {
  [K in LogLevel]: FlexibleLogFn
} & {
  child: (bindings: object) => FlexibleLogger
}

/**
 * Create a flexible wrapper around a logger
 * that accepts both (msg, obj) and (obj, msg) patterns
 */
function createFlexibleLogger(baseLogger: Logger): FlexibleLogger {
  const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']

  const wrapper = {} as FlexibleLogger

  for (const level of levels) {
    wrapper[level] = (msgOrObj: string | object, dataOrMsg?: object | string) => {
      if (typeof msgOrObj === 'string') {
        // Called as log.info("message", { data })
        baseLogger[level](dataOrMsg as object || {}, msgOrObj)
      } else {
        // Called as log.info({ data }, "message")
        baseLogger[level](msgOrObj, dataOrMsg as string)
      }
    }
  }

  wrapper.child = (bindings: object) => {
    return createFlexibleLogger(baseLogger.child(bindings))
  }

  return wrapper
}

/**
 * Get a logger that automatically includes request context
 *
 * @param module - Optional module name for log categorization
 * @returns A flexible logger with request context bindings
 *
 * @example
 * const log = getLogger('mutations.bill')
 * log.info('Processing payment', { billId: '123' })
 * // Output includes requestId, userId, path automatically
 */
export function getLogger(module?: string): FlexibleLogger {
  const baseLogger = module ? createLogger(module) : logger
  const ctx = getRequestContext()

  let contextLogger: Logger
  if (ctx) {
    contextLogger = baseLogger.child({
      requestId: ctx.requestId,
      userId: ctx.user?.id,
      userEmail: ctx.user?.email,
      userRole: ctx.user?.role,
      path: ctx.path,
    })
  } else {
    contextLogger = baseLogger
  }

  return createFlexibleLogger(contextLogger)
}

/**
 * Convenience logging functions with automatic context
 *
 * @example
 * log.info('Bill created', { billId: '123' })
 * log.error('Payment failed', { error: err.message })
 */
export const log = {
  trace: (msg: string, data?: object) => getLogger().trace(data || {}, msg),
  debug: (msg: string, data?: object) => getLogger().debug(data || {}, msg),
  info: (msg: string, data?: object) => getLogger().info(data || {}, msg),
  warn: (msg: string, data?: object) => getLogger().warn(data || {}, msg),
  error: (msg: string, data?: object) => getLogger().error(data || {}, msg),
  fatal: (msg: string, data?: object) => getLogger().fatal(data || {}, msg),
}
