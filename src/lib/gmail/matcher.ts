import { Pool } from "pg"
import type { ParsedEmail } from "@/types/gmail"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export interface VendorInfo {
  id: string
  name: string
  email: string | null
  company: string | null
  specialties: string[]
}

export interface MatchResult {
  vendorId: string | null
  vendorName: string | null
  matchType: "exact" | "domain" | null
  confidence: number // 0-1
}

/**
 * Get all active vendors with their email addresses.
 */
export async function getActiveVendors(): Promise<VendorInfo[]> {
  const result = await pool.query(`
    SELECT id, name, email, company, specialties
    FROM vendors
    WHERE is_active = TRUE AND email IS NOT NULL AND email != ''
    ORDER BY name
  `)
  return result.rows
}

/**
 * Parse all email addresses from a vendor's email field.
 * Vendors can have multiple emails separated by commas or semicolons.
 */
function parseVendorEmails(emailField: string | null): string[] {
  if (!emailField) return []
  return emailField
    .split(/[,;]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"))
}

/**
 * Extract domain from an email address.
 */
function extractDomain(email: string): string | null {
  const match = email.toLowerCase().match(/@([^@]+)$/)
  return match ? match[1] : null
}

/**
 * Match a sender email to a vendor.
 * Returns the best match found.
 */
export async function matchEmailToVendor(
  senderEmail: string,
  senderName: string | null
): Promise<MatchResult> {
  const vendors = await getActiveVendors()
  const senderEmailLower = senderEmail.toLowerCase()
  const senderDomain = extractDomain(senderEmailLower)

  // Priority 1: Exact email match
  for (const vendor of vendors) {
    const vendorEmails = parseVendorEmails(vendor.email)
    if (vendorEmails.includes(senderEmailLower)) {
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        matchType: "exact",
        confidence: 1.0,
      }
    }
  }

  // Priority 2: Domain match (excluding common/public email providers)
  const commonDomains = new Set([
    // Major providers
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.ca",
    "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.co.uk", "live.com", "msn.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "aol.co.uk",
    // ISP providers
    "comcast.net", "xfinity.com", "verizon.net", "att.net", "sbcglobal.net",
    "cox.net", "charter.net", "spectrum.net", "frontier.com", "centurylink.net",
    "earthlink.net", "windstream.net", "optimum.net", "optonline.net",
    // Other common providers
    "protonmail.com", "proton.me", "tutanota.com", "zoho.com",
    "ymail.com", "rocketmail.com", "mail.com", "email.com",
    "usa.com", "post.com", "inbox.com", "gmx.com", "gmx.net",
    // International
    "mail.ru", "yandex.com", "qq.com", "163.com", "126.com",
    "web.de", "freenet.de", "t-online.de", "orange.fr", "wanadoo.fr",
    "libero.it", "virgilio.it", "btinternet.com", "sky.com", "talktalk.net",
    // Educational (often personal accounts)
    "edu", "ac.uk",
  ])

  if (senderDomain && !commonDomains.has(senderDomain)) {
    for (const vendor of vendors) {
      const vendorEmails = parseVendorEmails(vendor.email)
      for (const vendorEmail of vendorEmails) {
        const vendorDomain = extractDomain(vendorEmail)
        if (vendorDomain === senderDomain) {
          return {
            vendorId: vendor.id,
            vendorName: vendor.name,
            matchType: "domain",
            confidence: 0.8,
          }
        }
      }
    }
  }

  // No match found (name matching disabled to prevent false positives)
  return {
    vendorId: null,
    vendorName: null,
    matchType: null,
    confidence: 0,
  }
}

/**
 * Batch match multiple emails to vendors.
 * More efficient for processing many emails at once.
 */
export async function matchEmailsToVendors(
  emails: ParsedEmail[]
): Promise<Map<string, MatchResult>> {
  const vendors = await getActiveVendors()
  const results = new Map<string, MatchResult>()

  // Build lookup maps for faster matching
  const exactEmailMap = new Map<string, VendorInfo>()
  const domainMap = new Map<string, VendorInfo[]>()

  for (const vendor of vendors) {
    const vendorEmails = parseVendorEmails(vendor.email)
    for (const email of vendorEmails) {
      exactEmailMap.set(email, vendor)

      const domain = extractDomain(email)
      if (domain) {
        if (!domainMap.has(domain)) {
          domainMap.set(domain, [])
        }
        domainMap.get(domain)!.push(vendor)
      }
    }
  }

  const commonDomains = new Set([
    // Major providers
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.ca",
    "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.co.uk", "live.com", "msn.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "aol.co.uk",
    // ISP providers
    "comcast.net", "xfinity.com", "verizon.net", "att.net", "sbcglobal.net",
    "cox.net", "charter.net", "spectrum.net", "frontier.com", "centurylink.net",
    "earthlink.net", "windstream.net", "optimum.net", "optonline.net",
    // Other common providers
    "protonmail.com", "proton.me", "tutanota.com", "zoho.com",
    "ymail.com", "rocketmail.com", "mail.com", "email.com",
    "usa.com", "post.com", "inbox.com", "gmx.com", "gmx.net",
    // International
    "mail.ru", "yandex.com", "qq.com", "163.com", "126.com",
    "web.de", "freenet.de", "t-online.de", "orange.fr", "wanadoo.fr",
    "libero.it", "virgilio.it", "btinternet.com", "sky.com", "talktalk.net",
    // Educational (often personal accounts)
    "edu", "ac.uk",
  ])

  for (const email of emails) {
    const senderEmail = email.from.email.toLowerCase()
    const senderName = email.from.name
    const senderDomain = extractDomain(senderEmail)

    // Try exact match first
    const exactMatch = exactEmailMap.get(senderEmail)
    if (exactMatch) {
      results.set(email.messageId, {
        vendorId: exactMatch.id,
        vendorName: exactMatch.name,
        matchType: "exact",
        confidence: 1.0,
      })
      continue
    }

    // Try domain match
    if (senderDomain && !commonDomains.has(senderDomain)) {
      const domainMatches = domainMap.get(senderDomain)
      if (domainMatches && domainMatches.length > 0) {
        // Use the first domain match (could be improved with fuzzy matching)
        results.set(email.messageId, {
          vendorId: domainMatches[0].id,
          vendorName: domainMatches[0].name,
          matchType: "domain",
          confidence: 0.8,
        })
        continue
      }
    }

    // No match (name matching disabled to prevent false positives)
    results.set(email.messageId, {
      vendorId: null,
      vendorName: null,
      matchType: null,
      confidence: 0,
    })
  }

  return results
}

/**
 * Get the user's email address for determining email direction.
 */
export function getUserEmail(): string {
  return process.env.NOTIFICATION_EMAIL || "anne@annespalter.com"
}

/**
 * Determine if an email is inbound or outbound.
 */
export function getEmailDirection(
  email: ParsedEmail,
  userEmail: string = getUserEmail()
): "inbound" | "outbound" {
  const userEmailLower = userEmail.toLowerCase()
  const fromEmailLower = email.from.email.toLowerCase()

  if (fromEmailLower === userEmailLower) {
    return "outbound"
  }
  return "inbound"
}

/**
 * Check if an email should be considered urgent.
 */
export function isUrgentEmail(email: ParsedEmail): boolean {
  const urgentKeywords = [
    "urgent",
    "emergency",
    "immediate",
    "asap",
    "critical",
    "time-sensitive",
    "action required",
    "important",
  ]

  const subjectLower = email.subject?.toLowerCase() || ""
  const snippetLower = email.snippet?.toLowerCase() || ""

  for (const keyword of urgentKeywords) {
    if (subjectLower.includes(keyword) || snippetLower.includes(keyword)) {
      return true
    }
  }

  return false
}
