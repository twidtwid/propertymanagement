// Gmail Integration Module

export {
  getAuthUrl,
  exchangeCodeForTokens,
  storeTokens,
  getStoredTokens,
  isGmailConnected,
  getGmailConnectionInfo,
  revokeTokens,
  refreshTokenIfNeeded,
} from "./auth"

export {
  getGmailClient,
  listMessages,
  getMessage,
  getMessagesInBatches,
  parseMessage,
  fetchMessagesForDateRange,
} from "./client"

export { analyzeEmails, formatAnalysisSummary } from "./analysis"

export {
  matchEmailToVendor,
  matchEmailsToVendors,
  getEmailDirection,
  isUrgentEmail,
  getUserEmail,
  getActiveVendors,
} from "./matcher"

export {
  syncEmails,
  importHistoricalEmails,
  getVendorCommunications,
  getRecentCommunications,
  getUrgentUnreadCommunications,
} from "./sync"

export {
  sendEmail,
  sendDailySummaryEmail,
  sendUrgentNotificationEmail,
} from "./send"

export type { SyncResult, SyncState } from "./sync"
export type { VendorInfo, MatchResult } from "./matcher"
