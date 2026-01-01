/**
 * Audit Service
 *
 * Provides persistent audit logging to PostgreSQL for:
 * - User action tracking (who did what, when)
 * - Change history (old vs new values)
 * - Compliance and security auditing
 */

import { query } from '@/lib/db'
import { getRequestContext } from './context'
import { getLogger } from './contextual'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'view'
  | 'export'
  | 'import'
  | 'confirm'
  | 'mark_paid'

export interface AuditEntry {
  action: AuditAction
  entityType: string
  entityId?: string
  entityName?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  metadata?: Record<string, unknown>
}

/**
 * Record an audit log entry
 *
 * Automatically captures:
 * - Current user (id, email, role)
 * - Request context (requestId, IP, user agent, path)
 * - Timestamp
 *
 * @example
 * await audit({
 *   action: 'update',
 *   entityType: 'bill',
 *   entityId: bill.id,
 *   entityName: bill.description,
 *   changes: { status: { old: 'pending', new: 'confirmed' } }
 * })
 */
export async function audit(entry: AuditEntry): Promise<void> {
  const ctx = getRequestContext()
  const log = getLogger('audit')

  try {
    await query(
      `INSERT INTO user_audit_log (
        user_id, user_email, user_role,
        action, entity_type, entity_id, entity_name,
        changes, metadata,
        request_id, ip_address, user_agent, path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        ctx?.user?.id || null,
        ctx?.user?.email || null,
        ctx?.user?.role || null,
        entry.action,
        entry.entityType,
        entry.entityId || null,
        entry.entityName || null,
        entry.changes ? JSON.stringify(entry.changes) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : '{}',
        ctx?.requestId || null,
        ctx?.ipAddress || null,
        ctx?.userAgent || null,
        ctx?.path || null,
      ]
    )

    log.debug('Audit entry recorded', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
    })
  } catch (error) {
    // Log but don't throw - audit failures shouldn't break the app
    log.error('Failed to record audit entry', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entry,
    })
  }
}

/**
 * Compute changes between old and new values for update operations
 *
 * @param oldValue - The original object
 * @param newValue - The updated object (partial)
 * @param sensitiveFields - Fields to redact from the audit log
 * @returns Object mapping field names to {old, new} pairs, or undefined if no changes
 *
 * @example
 * const changes = computeChanges(
 *   { status: 'pending', amount: 100 },
 *   { status: 'confirmed' },
 *   ['password']
 * )
 * // Returns: { status: { old: 'pending', new: 'confirmed' } }
 */
export function computeChanges<T extends Record<string, unknown>>(
  oldValue: T,
  newValue: Partial<T>,
  sensitiveFields: string[] = ['login_info', 'password', 'token']
): Record<string, { old: unknown; new: unknown }> | undefined {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(newValue)) {
    const oldVal = oldValue[key]
    const newVal = newValue[key]

    // Skip if values are equal
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      continue
    }

    const isSensitive = sensitiveFields.includes(key)
    changes[key] = {
      old: isSensitive ? '[REDACTED]' : oldVal,
      new: isSensitive ? '[REDACTED]' : newVal,
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined
}

/**
 * Get audit history for an entity
 */
export async function getAuditHistory(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  return query<AuditLogEntry>(
    `SELECT * FROM user_audit_log
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [entityType, entityId, limit]
  )
}

/**
 * Get recent audit entries for a user
 */
export async function getUserAuditHistory(
  userId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  return query<AuditLogEntry>(
    `SELECT * FROM user_audit_log
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )
}

// Type for audit log entries from database
export interface AuditLogEntry {
  id: string
  user_id: string | null
  user_email: string | null
  user_role: string | null
  action: AuditAction
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  changes: Record<string, { old: unknown; new: unknown }> | null
  metadata: Record<string, unknown>
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
  path: string | null
  created_at: string
}
