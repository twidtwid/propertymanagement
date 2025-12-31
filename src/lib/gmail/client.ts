import { google, gmail_v1 } from "googleapis"
import { getOAuth2Client, getStoredTokens, refreshTokenIfNeeded } from "./auth"
import type { GmailMessage, ParsedEmail, GmailMessagePart } from "@/types/gmail"

/**
 * Get an authenticated Gmail API client for a user.
 */
export async function getGmailClient(
  userEmail: string
): Promise<gmail_v1.Gmail> {
  // Refresh token if needed
  await refreshTokenIfNeeded(userEmail)

  const tokens = await getStoredTokens(userEmail)
  if (!tokens) {
    throw new Error(`No Gmail tokens found for ${userEmail}`)
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials(tokens)

  return google.gmail({ version: "v1", auth: oauth2Client })
}

/**
 * List messages matching a query.
 */
export async function listMessages(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults = 100,
  pageToken?: string
): Promise<{ messages: { id: string; threadId: string }[]; nextPageToken?: string }> {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
    pageToken,
  })

  const messages = (response.data.messages || [])
    .filter((m): m is { id: string; threadId: string } =>
      typeof m.id === 'string' && typeof m.threadId === 'string'
    )

  return {
    messages,
    nextPageToken: response.data.nextPageToken || undefined,
  }
}

/**
 * Get a single message by ID.
 */
export async function getMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
  format: "full" | "metadata" | "minimal" = "full"
): Promise<GmailMessage> {
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format,
  })

  return response.data as GmailMessage
}

/**
 * Get messages in batches to avoid rate limits.
 */
export async function getMessagesInBatches(
  gmail: gmail_v1.Gmail,
  messageIds: string[],
  batchSize = 50,
  onProgress?: (processed: number, total: number) => void
): Promise<GmailMessage[]> {
  const messages: GmailMessage[] = []

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize)
    const batchPromises = batch.map((id) =>
      getMessage(gmail, id, "full").catch((error) => {
        console.warn(`Failed to fetch message ${id}:`, error.message)
        return null
      })
    )

    const batchResults = await Promise.all(batchPromises)
    messages.push(...batchResults.filter((m): m is GmailMessage => m !== null))

    if (onProgress) {
      onProgress(Math.min(i + batchSize, messageIds.length), messageIds.length)
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < messageIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return messages
}

/**
 * Extract a header value from a Gmail message.
 */
function getHeader(headers: { name: string; value: string }[], name: string): string {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value || ""
}

/**
 * Parse an email address string like "John Doe <john@example.com>"
 */
function parseEmailAddress(raw: string): { email: string; name: string | null } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/)
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() }
  }
  return { name: null, email: raw.trim() }
}

/**
 * Decode base64url encoded content.
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(base64, "base64").toString("utf8")
}

/**
 * Extract text body from message parts recursively.
 */
function extractBody(
  parts: GmailMessagePart[] | undefined,
  mimeType: "text/plain" | "text/html"
): string | null {
  if (!parts) return null

  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }
    if (part.parts) {
      const nested = extractBody(part.parts, mimeType)
      if (nested) return nested
    }
  }

  return null
}

/**
 * Extract attachment info from message parts.
 */
function extractAttachments(
  parts: GmailMessagePart[] | undefined
): string[] {
  if (!parts) return []

  const attachments: string[] = []

  for (const part of parts) {
    if (part.filename && part.filename.length > 0) {
      attachments.push(part.filename)
    }
    if (part.parts) {
      attachments.push(...extractAttachments(part.parts))
    }
  }

  return attachments
}

/**
 * Parse a raw Gmail message into a structured format.
 */
export function parseMessage(message: GmailMessage): ParsedEmail {
  const headers = message.payload.headers || []

  const fromRaw = getHeader(headers, "From")
  const from = parseEmailAddress(fromRaw)

  const toRaw = getHeader(headers, "To")
  const to = toRaw.split(",").map((addr) => parseEmailAddress(addr.trim()).email)

  const subject = getHeader(headers, "Subject")
  const receivedAt = new Date(parseInt(message.internalDate))

  let bodyText: string | null = null
  let bodyHtml: string | null = null

  // Check for simple body first
  if (message.payload.body?.data) {
    const decoded = decodeBase64Url(message.payload.body.data)
    if (message.payload.mimeType === "text/html") {
      bodyHtml = decoded
    } else {
      bodyText = decoded
    }
  }

  // Check parts for multipart messages
  if (message.payload.parts) {
    bodyText = bodyText || extractBody(message.payload.parts, "text/plain")
    bodyHtml = bodyHtml || extractBody(message.payload.parts, "text/html")
  }

  const attachmentNames = extractAttachments(message.payload.parts)

  return {
    messageId: message.id,
    threadId: message.threadId,
    from,
    to,
    subject,
    snippet: message.snippet,
    bodyText,
    bodyHtml,
    receivedAt,
    labels: message.labelIds || [],
    hasAttachments: attachmentNames.length > 0,
    attachmentNames,
  }
}

/**
 * Fetch all messages for a date range.
 */
export async function fetchMessagesForDateRange(
  userEmail: string,
  startDate: Date,
  endDate: Date,
  onProgress?: (fetched: number, phase: string) => void
): Promise<ParsedEmail[]> {
  const gmail = await getGmailClient(userEmail)

  // Format dates for Gmail query
  const startStr = startDate.toISOString().split("T")[0].replace(/-/g, "/")
  const endStr = endDate.toISOString().split("T")[0].replace(/-/g, "/")
  const query = `after:${startStr} before:${endStr}`

  // Collect all message IDs
  const allMessageIds: string[] = []
  let pageToken: string | undefined

  onProgress?.(0, "Fetching message list...")

  do {
    const { messages, nextPageToken } = await listMessages(
      gmail,
      query,
      500,
      pageToken
    )
    allMessageIds.push(...messages.map((m) => m.id))
    pageToken = nextPageToken
    onProgress?.(allMessageIds.length, `Found ${allMessageIds.length} messages...`)
  } while (pageToken)

  if (allMessageIds.length === 0) {
    return []
  }

  onProgress?.(0, `Fetching ${allMessageIds.length} message details...`)

  // Fetch full message details
  const messages = await getMessagesInBatches(
    gmail,
    allMessageIds,
    50,
    (processed, total) => {
      onProgress?.(processed, `Processing ${processed}/${total} messages...`)
    }
  )

  // Parse all messages
  return messages.map(parseMessage)
}
