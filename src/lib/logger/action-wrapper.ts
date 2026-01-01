/**
 * Server Action Wrapper
 *
 * Wraps server actions with:
 * - Automatic audit logging
 * - Request context initialization
 * - Change tracking for updates
 * - Error logging
 */

import { headers } from 'next/headers'
import { getUser } from '@/lib/auth'
import { requestContext, createRequestContext } from './context'
import { getLogger } from './contextual'
import { audit, computeChanges, type AuditAction } from './audit'

// Standard action result type
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

interface AuditOptions<T> {
  /** The type of action being performed */
  action: AuditAction
  /** The entity type (e.g., 'property', 'bill', 'vendor') */
  entityType: string
  /** The entity ID (can be extracted from result if not known upfront) */
  entityId?: string | ((result: T) => string | undefined)
  /** Human-readable entity name for the audit log */
  entityName?: string | ((result: T) => string | undefined)
  /** Function to get old value for computing changes on updates */
  getOldValue?: () => Promise<Record<string, unknown> | null>
  /** Additional metadata to include in audit log */
  metadata?: Record<string, unknown>
}

/**
 * Wrap a server action with audit logging
 *
 * @example
 * const createPropertyCore = async (data: PropertyInput) => {
 *   // ... create property
 *   return { success: true, data: property }
 * }
 *
 * export const createProperty = withAudit(createPropertyCore, {
 *   action: 'create',
 *   entityType: 'property',
 *   entityName: (result) => result.name,
 * })
 */
export function withAudit<TInput, TOutput>(
  actionFn: (input: TInput) => Promise<ActionResult<TOutput>>,
  options: AuditOptions<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    const user = await getUser()
    const headersList = await headers()

    const ctx = createRequestContext(
      user,
      headersList.get('x-invoke-path') || '/server-action',
      'POST',
      headersList.get('x-forwarded-for') || headersList.get('x-real-ip'),
      headersList.get('user-agent')
    )

    return requestContext.run(ctx, async () => {
      const log = getLogger(`action.${options.entityType}`)

      log.debug(`${options.action} ${options.entityType} started`, {
        hasInput: input !== undefined,
      })

      // Get old value for update operations
      let oldValue: Record<string, unknown> | null = null
      if (options.action === 'update' && options.getOldValue) {
        try {
          oldValue = await options.getOldValue()
        } catch (err) {
          log.warn('Failed to get old value for audit', {
            error: err instanceof Error ? err.message : 'Unknown',
          })
        }
      }

      const startTime = Date.now()

      try {
        const result = await actionFn(input)

        if (result.success && result.data) {
          // Extract entity ID and name
          const entityId =
            typeof options.entityId === 'function'
              ? options.entityId(result.data)
              : options.entityId || (result.data as { id?: string })?.id

          const entityName =
            typeof options.entityName === 'function'
              ? options.entityName(result.data)
              : options.entityName

          // Compute changes for updates
          let changes: Record<string, { old: unknown; new: unknown }> | undefined
          if (options.action === 'update' && oldValue && result.data) {
            changes = computeChanges(
              oldValue,
              result.data as Record<string, unknown>
            )
          }

          // Record audit log
          await audit({
            action: options.action,
            entityType: options.entityType,
            entityId,
            entityName,
            changes,
            metadata: options.metadata,
          })

          log.info(`${options.action} ${options.entityType} succeeded`, {
            entityId,
            duration: Date.now() - startTime,
          })
        } else {
          log.warn(`${options.action} ${options.entityType} failed`, {
            error: result.error,
            duration: Date.now() - startTime,
          })
        }

        return result
      } catch (error) {
        log.error(`${options.action} ${options.entityType} threw error`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          duration: Date.now() - startTime,
        })
        throw error
      }
    })
  }
}

/**
 * Simplified wrapper for actions that just need logging without full audit
 */
export function withActionLogging<TInput, TOutput>(
  actionFn: (input: TInput) => Promise<ActionResult<TOutput>>,
  actionName: string
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    const user = await getUser()
    const headersList = await headers()

    const ctx = createRequestContext(
      user,
      headersList.get('x-invoke-path') || '/server-action',
      'POST',
      headersList.get('x-forwarded-for'),
      headersList.get('user-agent')
    )

    return requestContext.run(ctx, async () => {
      const log = getLogger('action')
      const startTime = Date.now()

      log.debug(`${actionName} started`)

      try {
        const result = await actionFn(input)

        if (result.success) {
          log.info(`${actionName} succeeded`, {
            duration: Date.now() - startTime,
          })
        } else {
          log.warn(`${actionName} failed`, {
            error: result.error,
            duration: Date.now() - startTime,
          })
        }

        return result
      } catch (error) {
        log.error(`${actionName} threw error`, {
          error: error instanceof Error ? error.message : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
          duration: Date.now() - startTime,
        })
        throw error
      }
    })
  }
}
