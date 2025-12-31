import { query } from "@/lib/db"
import { fetchMessagesForDateRange } from "./client"
import type {
  ParsedEmail,
  EmailAnalysisReport,
  SenderSummary,
  VendorMatch,
  EmailPattern,
  PropertyMention,
} from "@/types/gmail"
import type { Vendor, Property } from "@/types/database"

// Keywords for email pattern detection
const PATTERN_KEYWORDS = {
  invoice: ["invoice", "statement", "bill", "payment due", "amount due", "balance"],
  service: ["scheduled", "confirmed", "appointment", "service call", "visit"],
  urgent: ["urgent", "emergency", "immediate", "asap", "critical", "important"],
  quote: ["quote", "estimate", "proposal", "bid"],
  receipt: ["receipt", "paid", "payment received", "thank you for your payment"],
  renewal: ["renewal", "renew", "expiring", "expires", "expiration"],
}

/**
 * Analyze all emails from a date range and produce a comprehensive report.
 */
export async function analyzeEmails(
  userEmail: string,
  startDate: Date,
  endDate: Date,
  onProgress?: (message: string) => void
): Promise<EmailAnalysisReport> {
  onProgress?.("Fetching emails from Gmail...")

  // Fetch all emails for the period
  const emails = await fetchMessagesForDateRange(userEmail, startDate, endDate, (count, phase) => {
    onProgress?.(phase)
  })

  onProgress?.(`Analyzing ${emails.length} emails...`)

  // Get vendors and properties from database for matching
  const vendors = await query<Vendor>("SELECT * FROM vendors")
  const properties = await query<Property>("SELECT * FROM properties")

  // Build analysis
  const senderMap = new Map<string, SenderSummary>()
  const vendorEmailMap = buildVendorEmailMap(vendors)
  const vendorMatches = new Map<string, VendorMatch>()
  const patternCounts: Record<string, { count: number; examples: string[] }> = {}
  const propertyMentions = new Map<string, { count: number; keywords: Set<string> }>()

  for (const email of emails) {
    // Track senders
    const senderEmail = email.from.email.toLowerCase()
    const existing = senderMap.get(senderEmail)
    if (existing) {
      existing.count++
      if (new Date(email.receivedAt) > new Date(existing.latestDate)) {
        existing.latestDate = email.receivedAt.toISOString()
      }
    } else {
      senderMap.set(senderEmail, {
        email: senderEmail,
        name: email.from.name,
        count: 1,
        latestDate: email.receivedAt.toISOString(),
      })
    }

    // Match to vendors
    const matchedVendor = vendorEmailMap.get(senderEmail)
    if (matchedVendor) {
      const vendorMatch = vendorMatches.get(matchedVendor.id)
      if (vendorMatch) {
        vendorMatch.matchedEmails++
        if (!vendorMatch.senderEmails.includes(senderEmail)) {
          vendorMatch.senderEmails.push(senderEmail)
        }
      } else {
        vendorMatches.set(matchedVendor.id, {
          vendorId: matchedVendor.id,
          vendorName: matchedVendor.name,
          vendorEmail: matchedVendor.email,
          matchedEmails: 1,
          senderEmails: [senderEmail],
        })
      }
    }

    // Detect patterns
    const textToSearch = [
      email.subject,
      email.snippet,
      email.bodyText?.substring(0, 1000),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    for (const [patternName, keywords] of Object.entries(PATTERN_KEYWORDS)) {
      for (const keyword of keywords) {
        if (textToSearch.includes(keyword)) {
          if (!patternCounts[patternName]) {
            patternCounts[patternName] = { count: 0, examples: [] }
          }
          patternCounts[patternName].count++
          if (patternCounts[patternName].examples.length < 3) {
            patternCounts[patternName].examples.push(
              email.subject?.substring(0, 50) || email.snippet.substring(0, 50)
            )
          }
          break // Only count once per pattern per email
        }
      }
    }

    // Detect property mentions
    for (const property of properties) {
      const propertyKeywords = buildPropertyKeywords(property)
      for (const keyword of propertyKeywords) {
        if (textToSearch.includes(keyword.toLowerCase())) {
          const existing = propertyMentions.get(property.id)
          if (existing) {
            existing.count++
            existing.keywords.add(keyword)
          } else {
            propertyMentions.set(property.id, {
              count: 1,
              keywords: new Set([keyword]),
            })
          }
          break // Only count once per property per email
        }
      }
    }
  }

  // Build top senders list
  const topSenders = Array.from(senderMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Find unmatched frequent senders (potential new vendors)
  const matchedEmails = new Set(
    Array.from(vendorMatches.values()).flatMap((v) => v.senderEmails)
  )
  const unmatchedFrequentSenders = topSenders
    .filter((s) => !matchedEmails.has(s.email) && s.count >= 3)
    .slice(0, 10)

  // Build pattern analysis
  const emailPatterns: EmailPattern[] = Object.entries(patternCounts)
    .map(([pattern, data]) => ({
      pattern: formatPatternName(pattern),
      count: data.count,
      keywords: PATTERN_KEYWORDS[pattern as keyof typeof PATTERN_KEYWORDS] || [],
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count)

  // Build property mentions
  const propertyMentionsList: PropertyMention[] = []
  Array.from(propertyMentions.entries()).forEach(([propertyId, data]) => {
    const property = properties.find((p) => p.id === propertyId)
    propertyMentionsList.push({
      propertyId,
      propertyName: property?.name || null,
      keywords: Array.from(data.keywords),
      mentionCount: data.count,
    })
  })
  propertyMentionsList.sort((a, b) => b.mentionCount - a.mentionCount)

  // Generate recommendations
  const recommendations = generateRecommendations(
    vendors,
    Array.from(vendorMatches.values()),
    unmatchedFrequentSenders,
    emailPatterns
  )

  return {
    totalEmails: emails.length,
    dateRange: {
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    },
    uniqueSenders: senderMap.size,
    topSenders,
    vendorMatches: Array.from(vendorMatches.values()).sort(
      (a, b) => b.matchedEmails - a.matchedEmails
    ),
    unmatchedFrequentSenders,
    emailPatterns,
    propertyMentions: propertyMentionsList,
    recommendations,
  }
}

/**
 * Build a map of email addresses to vendors for quick lookup.
 */
function buildVendorEmailMap(
  vendors: Vendor[]
): Map<string, { id: string; name: string; email: string | null }> {
  const map = new Map()

  for (const vendor of vendors) {
    if (vendor.email) {
      // Handle multiple emails separated by comma or semicolon
      const emails = vendor.email.split(/[,;]/).map((e) => e.trim().toLowerCase())
      for (const email of emails) {
        if (email) {
          map.set(email, {
            id: vendor.id,
            name: vendor.name,
            email: vendor.email,
          })
        }
      }

      // Also try domain matching for company emails
      const domain = extractDomain(vendor.email)
      if (domain && !isCommonDomain(domain)) {
        // Store domain with vendor info for fuzzy matching
        map.set(`@${domain}`, {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
        })
      }
    }
  }

  return map
}

/**
 * Build keywords to search for property mentions.
 */
function buildPropertyKeywords(property: Property): string[] {
  const keywords: string[] = []

  // Property name
  keywords.push(property.name)

  // Address parts
  if (property.address) {
    // Street number and name
    const addressParts = property.address.split(" ")
    if (addressParts.length >= 2) {
      keywords.push(`${addressParts[0]} ${addressParts[1]}`)
    }
  }

  // City
  keywords.push(property.city)

  // State (if not too common)
  if (property.state && property.state.length > 2) {
    keywords.push(property.state)
  }

  return keywords.filter((k) => k && k.length > 2)
}

/**
 * Extract domain from email address.
 */
function extractDomain(email: string): string | null {
  const match = email.match(/@([^@]+)$/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Check if a domain is a common email provider (not company-specific).
 */
function isCommonDomain(domain: string): boolean {
  const commonDomains = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "aol.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "live.com",
    "msn.com",
    "protonmail.com",
    "mail.com",
  ]
  return commonDomains.includes(domain)
}

/**
 * Format pattern name for display.
 */
function formatPatternName(pattern: string): string {
  const names: Record<string, string> = {
    invoice: "Invoice/Billing",
    service: "Service Confirmations",
    urgent: "Urgent/Emergency",
    quote: "Quotes/Estimates",
    receipt: "Payment Receipts",
    renewal: "Renewals/Expirations",
  }
  return names[pattern] || pattern
}

/**
 * Generate actionable recommendations based on analysis.
 */
function generateRecommendations(
  vendors: Vendor[],
  vendorMatches: VendorMatch[],
  unmatchedSenders: SenderSummary[],
  patterns: EmailPattern[]
): string[] {
  const recommendations: string[] = []

  // Check for vendors without email addresses
  const vendorsWithoutEmail = vendors.filter((v) => !v.email && v.is_active)
  if (vendorsWithoutEmail.length > 0) {
    recommendations.push(
      `Add email addresses to ${vendorsWithoutEmail.length} active vendors for better email matching`
    )
  }

  // Suggest adding frequent senders as vendors
  if (unmatchedSenders.length > 0) {
    const topUnmatched = unmatchedSenders.slice(0, 5)
    recommendations.push(
      `Consider adding ${unmatchedSenders.length} frequent senders as vendors: ${topUnmatched.map((s) => s.email).join(", ")}`
    )
  }

  // Check for urgent emails that should trigger notifications
  const urgentPattern = patterns.find((p) => p.pattern === "Urgent/Emergency")
  if (urgentPattern && urgentPattern.count > 0) {
    recommendations.push(
      `Set up urgent email detection - found ${urgentPattern.count} potentially urgent emails in the analysis period`
    )
  }

  // Matched vendors percentage
  const matchedVendorIds = new Set(vendorMatches.map((v) => v.vendorId))
  const activeVendors = vendors.filter((v) => v.is_active)
  const matchPercentage = Math.round(
    (matchedVendorIds.size / activeVendors.length) * 100
  )
  if (matchPercentage < 50) {
    recommendations.push(
      `Only ${matchPercentage}% of active vendors matched to emails - consider updating vendor email addresses`
    )
  }

  // Invoice handling
  const invoicePattern = patterns.find((p) => p.pattern === "Invoice/Billing")
  if (invoicePattern && invoicePattern.count > 10) {
    recommendations.push(
      `${invoicePattern.count} invoice-related emails detected - good candidate for automatic bill tracking`
    )
  }

  return recommendations
}

/**
 * Get a summary of the analysis for display.
 */
export function formatAnalysisSummary(report: EmailAnalysisReport): string {
  const lines: string[] = [
    "EMAIL ANALYSIS REPORT",
    "",
    "VOLUME SUMMARY:",
    `- Total emails analyzed: ${report.totalEmails.toLocaleString()}`,
    `- Date range: ${report.dateRange.start} to ${report.dateRange.end}`,
    `- Unique senders: ${report.uniqueSenders}`,
    "",
    "TOP SENDERS (potential vendors):",
  ]

  for (const sender of report.topSenders.slice(0, 10)) {
    const match = report.vendorMatches.find((v) =>
      v.senderEmails.includes(sender.email)
    )
    const matchText = match
      ? `MATCHES: ${match.vendorName}`
      : "NO MATCH (add as vendor?)"
    lines.push(`  ${sender.count}x ${sender.email} - ${matchText}`)
  }

  lines.push("")
  lines.push("VENDOR EMAIL MATCHES:")
  lines.push(
    `- ${report.vendorMatches.length} vendors matched to incoming emails`
  )

  if (report.unmatchedFrequentSenders.length > 0) {
    lines.push(
      `- ${report.unmatchedFrequentSenders.length} frequent senders not matched to vendors`
    )
  }

  lines.push("")
  lines.push("EMAIL PATTERNS DETECTED:")
  for (const pattern of report.emailPatterns) {
    lines.push(`- ${pattern.pattern}: ${pattern.count} emails`)
  }

  if (report.propertyMentions.length > 0) {
    lines.push("")
    lines.push("PROPERTY MENTIONS (in subject/body):")
    for (const mention of report.propertyMentions.slice(0, 5)) {
      lines.push(
        `- "${mention.propertyName}": ${mention.mentionCount} emails (keywords: ${mention.keywords.join(", ")})`
      )
    }
  }

  lines.push("")
  lines.push("RECOMMENDED ACTIONS:")
  for (let i = 0; i < report.recommendations.length; i++) {
    lines.push(`${i + 1}. ${report.recommendations[i]}`)
  }

  return lines.join("\n")
}
