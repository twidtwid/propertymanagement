import { Pool } from "pg"
import { getGmailClient, listMessages, getMessage, parseMessage } from "./client"
import {
  matchEmailsToVendors,
  getEmailDirection,
  isUrgentEmail,
  getUserEmail,
} from "./matcher"
import type { ParsedEmail, VendorCommunication } from "@/types/gmail"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export interface SyncResult {
  success: boolean
  emailsFetched: number
  emailsMatched: number
  emailsStored: number
  urgentEmails: number
  errors: string[]
  syncedAt: Date
}

export interface SyncState {
  lastSyncAt: Date | null
  lastMessageId: string | null
  syncCount: number
}

/**
 * Get the current sync state from database.
 */
async function getSyncState(): Promise<SyncState> {
  const result = await pool.query(`
    SELECT last_sync_at, last_message_id, sync_count
    FROM email_sync_state
    WHERE user_email = $1
  `, [getUserEmail()])

  if (result.rows.length === 0) {
    return {
      lastSyncAt: null,
      lastMessageId: null,
      syncCount: 0,
    }
  }

  return {
    lastSyncAt: result.rows[0].last_sync_at ? new Date(result.rows[0].last_sync_at) : null,
    lastMessageId: result.rows[0].last_message_id,
    syncCount: result.rows[0].sync_count || 0,
  }
}

/**
 * Update the sync state after successful sync.
 */
async function updateSyncState(lastMessageId: string | null): Promise<void> {
  const userEmail = getUserEmail()

  await pool.query(`
    INSERT INTO email_sync_state (user_email, last_sync_at, last_message_id, sync_count)
    VALUES ($1, NOW(), $2, 1)
    ON CONFLICT (user_email)
    DO UPDATE SET
      last_sync_at = NOW(),
      last_message_id = COALESCE($2, email_sync_state.last_message_id),
      sync_count = email_sync_state.sync_count + 1
  `, [userEmail, lastMessageId])
}

/**
 * Check if an email already exists in the database.
 */
async function emailExists(gmailMessageId: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT 1 FROM vendor_communications
    WHERE gmail_message_id = $1
    LIMIT 1
  `, [gmailMessageId])
  return result.rows.length > 0
}

/**
 * Store a vendor communication in the database.
 */
async function storeVendorCommunication(
  email: ParsedEmail,
  vendorId: string | null,
  direction: "inbound" | "outbound",
  isImportant: boolean
): Promise<string | null> {
  try {
    const result = await pool.query(`
      INSERT INTO vendor_communications (
        vendor_id,
        gmail_message_id,
        thread_id,
        direction,
        from_email,
        to_email,
        subject,
        body_snippet,
        body_html,
        received_at,
        is_read,
        is_important,
        has_attachment,
        attachment_names,
        labels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (gmail_message_id) DO NOTHING
      RETURNING id
    `, [
      vendorId,
      email.messageId,
      email.threadId,
      direction,
      email.from.email,
      email.to.join(", "),
      email.subject,
      email.snippet,
      email.bodyHtml,
      email.receivedAt,
      false, // is_read defaults to false
      isImportant,
      email.hasAttachments,
      email.attachmentNames,
      email.labels,
    ])

    return result.rows[0]?.id || null
  } catch (error) {
    console.error("Failed to store communication:", error)
    return null
  }
}

/**
 * Sync new emails from Gmail.
 * Fetches emails since the last sync, matches them to vendors, and stores them.
 */
export async function syncEmails(options?: {
  maxResults?: number
  forceFullSync?: boolean
}): Promise<SyncResult> {
  const maxResults = options?.maxResults || 100
  const errors: string[] = []
  const userEmail = getUserEmail()

  try {
    // Get current sync state
    const syncState = await getSyncState()

    // Build query for new emails
    let query = ""
    if (syncState.lastSyncAt && !options?.forceFullSync) {
      // Fetch emails from last 24 hours to catch any we might have missed
      const since = new Date(syncState.lastSyncAt.getTime() - 24 * 60 * 60 * 1000)
      const sinceStr = since.toISOString().split("T")[0].replace(/-/g, "/")
      query = `after:${sinceStr}`
    } else {
      // First sync or forced full sync - get last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const sinceStr = thirtyDaysAgo.toISOString().split("T")[0].replace(/-/g, "/")
      query = `after:${sinceStr}`
    }

    console.log(`[Email Sync] Fetching emails with query: ${query}`)

    // Get Gmail client
    const gmail = await getGmailClient(userEmail)

    // Fetch message list
    const { messages } = await listMessages(gmail, query, maxResults)

    if (messages.length === 0) {
      console.log("[Email Sync] No new messages found")
      await updateSyncState(null)
      return {
        success: true,
        emailsFetched: 0,
        emailsMatched: 0,
        emailsStored: 0,
        urgentEmails: 0,
        errors: [],
        syncedAt: new Date(),
      }
    }

    console.log(`[Email Sync] Found ${messages.length} messages to process`)

    // Filter out already-processed emails
    const newMessageIds: string[] = []
    for (const msg of messages) {
      const exists = await emailExists(msg.id)
      if (!exists) {
        newMessageIds.push(msg.id)
      }
    }

    console.log(`[Email Sync] ${newMessageIds.length} new messages to import`)

    if (newMessageIds.length === 0) {
      await updateSyncState(messages[0]?.id || null)
      return {
        success: true,
        emailsFetched: messages.length,
        emailsMatched: 0,
        emailsStored: 0,
        urgentEmails: 0,
        errors: [],
        syncedAt: new Date(),
      }
    }

    // Fetch full message details
    const parsedEmails: ParsedEmail[] = []
    for (const messageId of newMessageIds.slice(0, 50)) { // Limit batch size
      try {
        const rawMessage = await getMessage(gmail, messageId, "full")
        const parsed = parseMessage(rawMessage)
        parsedEmails.push(parsed)
      } catch (error) {
        errors.push(`Failed to fetch message ${messageId}: ${error}`)
      }
    }

    console.log(`[Email Sync] Parsed ${parsedEmails.length} emails`)

    // Match emails to vendors
    const matchResults = await matchEmailsToVendors(parsedEmails)

    let emailsMatched = 0
    let emailsStored = 0
    let urgentEmails = 0

    // Store each email
    for (const email of parsedEmails) {
      const matchResult = matchResults.get(email.messageId)
      const vendorId = matchResult?.vendorId || null
      const direction = getEmailDirection(email, userEmail)
      const isUrgent = isUrgentEmail(email)

      if (vendorId) {
        emailsMatched++
      }
      if (isUrgent) {
        urgentEmails++
      }

      const stored = await storeVendorCommunication(
        email,
        vendorId,
        direction,
        isUrgent
      )

      if (stored) {
        emailsStored++
      }
    }

    console.log(`[Email Sync] Stored ${emailsStored} emails, ${emailsMatched} matched to vendors, ${urgentEmails} urgent`)

    // Update sync state
    await updateSyncState(messages[0]?.id || null)

    return {
      success: true,
      emailsFetched: messages.length,
      emailsMatched,
      emailsStored,
      urgentEmails,
      errors,
      syncedAt: new Date(),
    }
  } catch (error) {
    console.error("[Email Sync] Error:", error)
    return {
      success: false,
      emailsFetched: 0,
      emailsMatched: 0,
      emailsStored: 0,
      urgentEmails: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      syncedAt: new Date(),
    }
  }
}

/**
 * Import historical emails for a date range.
 * Used for one-time bulk import.
 */
export async function importHistoricalEmails(
  startDate: Date,
  endDate: Date,
  onProgress?: (current: number, total: number, phase: string) => void
): Promise<SyncResult> {
  const errors: string[] = []
  const userEmail = getUserEmail()

  try {
    const startStr = startDate.toISOString().split("T")[0].replace(/-/g, "/")
    const endStr = endDate.toISOString().split("T")[0].replace(/-/g, "/")
    const query = `after:${startStr} before:${endStr}`

    console.log(`[Historical Import] Query: ${query}`)
    onProgress?.(0, 0, "Fetching message list...")

    const gmail = await getGmailClient(userEmail)

    // Collect all message IDs
    const allMessageIds: string[] = []
    let pageToken: string | undefined

    do {
      const { messages, nextPageToken } = await listMessages(
        gmail,
        query,
        500,
        pageToken
      )
      allMessageIds.push(...messages.map((m) => m.id))
      pageToken = nextPageToken
      onProgress?.(allMessageIds.length, 0, `Found ${allMessageIds.length} messages...`)
    } while (pageToken)

    console.log(`[Historical Import] Found ${allMessageIds.length} total messages`)

    if (allMessageIds.length === 0) {
      return {
        success: true,
        emailsFetched: 0,
        emailsMatched: 0,
        emailsStored: 0,
        urgentEmails: 0,
        errors: [],
        syncedAt: new Date(),
      }
    }

    // Filter out already-imported emails
    const newMessageIds: string[] = []
    for (const id of allMessageIds) {
      const exists = await emailExists(id)
      if (!exists) {
        newMessageIds.push(id)
      }
    }

    console.log(`[Historical Import] ${newMessageIds.length} new messages to import`)
    onProgress?.(0, newMessageIds.length, `Importing ${newMessageIds.length} new emails...`)

    let emailsMatched = 0
    let emailsStored = 0
    let urgentEmails = 0
    const batchSize = 50

    // Process in batches
    for (let i = 0; i < newMessageIds.length; i += batchSize) {
      const batch = newMessageIds.slice(i, i + batchSize)
      const parsedEmails: ParsedEmail[] = []

      // Fetch message details
      for (const messageId of batch) {
        try {
          const rawMessage = await getMessage(gmail, messageId, "full")
          const parsed = parseMessage(rawMessage)
          parsedEmails.push(parsed)
        } catch (error) {
          errors.push(`Failed to fetch message ${messageId}`)
        }
      }

      // Match to vendors
      const matchResults = await matchEmailsToVendors(parsedEmails)

      // Store each email
      for (const email of parsedEmails) {
        const matchResult = matchResults.get(email.messageId)
        const vendorId = matchResult?.vendorId || null
        const direction = getEmailDirection(email, userEmail)
        const isUrgent = isUrgentEmail(email)

        if (vendorId) {
          emailsMatched++
        }
        if (isUrgent) {
          urgentEmails++
        }

        const stored = await storeVendorCommunication(
          email,
          vendorId,
          direction,
          isUrgent
        )

        if (stored) {
          emailsStored++
        }
      }

      onProgress?.(i + batch.length, newMessageIds.length, `Imported ${i + batch.length}/${newMessageIds.length}`)

      // Small delay to avoid rate limits
      if (i + batchSize < newMessageIds.length) {
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    console.log(`[Historical Import] Complete: ${emailsStored} stored, ${emailsMatched} matched`)

    return {
      success: true,
      emailsFetched: allMessageIds.length,
      emailsMatched,
      emailsStored,
      urgentEmails,
      errors,
      syncedAt: new Date(),
    }
  } catch (error) {
    console.error("[Historical Import] Error:", error)
    return {
      success: false,
      emailsFetched: 0,
      emailsMatched: 0,
      emailsStored: 0,
      urgentEmails: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      syncedAt: new Date(),
    }
  }
}

/**
 * Get recent vendor communications for a specific vendor.
 */
export async function getVendorCommunications(
  vendorId: string,
  limit = 50,
  offset = 0
): Promise<VendorCommunication[]> {
  const result = await pool.query(`
    SELECT
      vc.*,
      v.name as vendor_name,
      v.company as vendor_company
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.vendor_id = $1
    ORDER BY vc.received_at DESC
    LIMIT $2 OFFSET $3
  `, [vendorId, limit, offset])

  return result.rows.map((row) => ({
    ...row,
    vendor: row.vendor_id ? {
      id: row.vendor_id,
      name: row.vendor_name,
      company: row.vendor_company,
    } : undefined,
  }))
}

/**
 * Get all recent communications (for dashboard/summary).
 */
export async function getRecentCommunications(
  limit = 20
): Promise<VendorCommunication[]> {
  const result = await pool.query(`
    SELECT
      vc.*,
      v.name as vendor_name,
      v.company as vendor_company
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    ORDER BY vc.received_at DESC
    LIMIT $1
  `, [limit])

  return result.rows.map((row) => ({
    ...row,
    vendor: row.vendor_id ? {
      id: row.vendor_id,
      name: row.vendor_name,
      company: row.vendor_company,
    } : undefined,
  }))
}

/**
 * Get urgent communications that haven't been read.
 */
export async function getUrgentUnreadCommunications(): Promise<VendorCommunication[]> {
  const result = await pool.query(`
    SELECT
      vc.*,
      v.name as vendor_name,
      v.company as vendor_company
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.is_important = TRUE AND vc.is_read = FALSE
    ORDER BY vc.received_at DESC
  `)

  return result.rows.map((row) => ({
    ...row,
    vendor: row.vendor_id ? {
      id: row.vendor_id,
      name: row.vendor_name,
      company: row.vendor_company,
    } : undefined,
  }))
}
