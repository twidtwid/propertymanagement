// Gmail Integration Types

export interface GmailOAuthTokens {
  id: string
  user_email: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expiry: string
  scopes: string[]
  created_at: string
  updated_at: string
}

export interface VendorCommunication {
  id: string
  vendor_id: string | null
  gmail_message_id: string
  thread_id: string | null
  direction: "inbound" | "outbound"
  from_email: string
  to_email: string
  subject: string | null
  body_snippet: string | null
  body_html: string | null
  received_at: string
  is_read: boolean
  is_important: boolean
  has_attachment: boolean
  attachment_names: string[]
  labels: string[]
  created_at: string
  // Joined fields
  vendor?: {
    id: string
    name: string
    company: string | null
  }
}

export interface NotificationLog {
  id: string
  recipient_email: string
  notification_type: string
  subject: string
  body_html: string | null
  sent_at: string
  gmail_message_id: string | null
}

export interface DailySummary {
  id: string
  summary_date: string
  actions_taken: DailySummaryAction[]
  urgent_items: DailySummaryItem[]
  upcoming_items: DailySummaryItem[]
  sent_at: string | null
  created_at: string
}

export interface DailySummaryAction {
  type: "payment_confirmed" | "task_added" | "task_completed" | "bill_paid" | "other"
  description: string
  timestamp: string
}

export interface DailySummaryItem {
  type: "payment_overdue" | "check_unconfirmed" | "insurance_expiring" | "tax_due" | "registration_due" | "maintenance_due" | "other"
  description: string
  due_date?: string
  severity: "info" | "warning" | "critical"
}

// Email Analysis Types

export interface EmailAnalysisReport {
  totalEmails: number
  dateRange: {
    start: string
    end: string
  }
  uniqueSenders: number
  topSenders: SenderSummary[]
  vendorMatches: VendorMatch[]
  unmatchedFrequentSenders: SenderSummary[]
  emailPatterns: EmailPattern[]
  propertyMentions: PropertyMention[]
  recommendations: string[]
}

export interface SenderSummary {
  email: string
  name: string | null
  count: number
  latestDate: string
}

export interface VendorMatch {
  vendorId: string
  vendorName: string
  vendorEmail: string | null
  matchedEmails: number
  senderEmails: string[]
}

export interface EmailPattern {
  pattern: string
  count: number
  keywords: string[]
  examples: string[]
}

export interface PropertyMention {
  propertyId: string | null
  propertyName: string | null
  keywords: string[]
  mentionCount: number
}

// Gmail API Response Types

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: GmailMessagePayload
  internalDate: string
}

export interface GmailMessagePayload {
  headers: GmailHeader[]
  mimeType: string
  body?: {
    data?: string
    size: number
  }
  parts?: GmailMessagePart[]
}

export interface GmailHeader {
  name: string
  value: string
}

export interface GmailMessagePart {
  partId: string
  mimeType: string
  filename: string
  body?: {
    data?: string
    size: number
    attachmentId?: string
  }
  parts?: GmailMessagePart[]
}

// Parsed Email Type

export interface ParsedEmail {
  messageId: string
  threadId: string
  from: {
    email: string
    name: string | null
  }
  to: string[]
  subject: string
  snippet: string
  bodyText: string | null
  bodyHtml: string | null
  receivedAt: Date
  labels: string[]
  hasAttachments: boolean
  attachmentNames: string[]
}

// Analysis Progress

export interface AnalysisProgress {
  status: "idle" | "fetching" | "analyzing" | "complete" | "error"
  totalMessages: number
  processedMessages: number
  currentBatch: number
  error?: string
}

// OAuth State

export interface OAuthState {
  isConnected: boolean
  userEmail: string | null
  connectedAt: string | null
  scopes: string[]
}
