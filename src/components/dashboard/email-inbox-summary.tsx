"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GmailViewLink } from "@/components/ui/gmail-view-link"
import { Mail, ChevronRight, AlertCircle, Inbox } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import type { PaymentSuggestion } from "@/types/database"

interface EmailInboxSummaryProps {
  suggestions: PaymentSuggestion[]
  otherEmails: Array<{
    vendorName: string | null
    subject: string
    receivedAt: string
    isUrgent: boolean
    snippet?: string
    bodyHtml?: string
  }>
}

// Sanitize email HTML to prevent style bleeding
function sanitizeEmailHtml(html: string): string {
  let sanitized = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  sanitized = sanitized.replace(/<link[^>]*>/gi, '')
  return sanitized
}

export function EmailInboxSummary({ suggestions, otherEmails }: EmailInboxSummaryProps) {
  const [mounted, setMounted] = useState(false)
  const [showOtherEmails, setShowOtherEmails] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const hasSuggestions = suggestions.length > 0
  const hasOtherEmails = otherEmails.length > 0

  if (!hasSuggestions && !hasOtherEmails) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Needs Review Section */}
      {hasSuggestions && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Inbox className="h-5 w-5 text-orange-600" />
                <span className="text-orange-900">Needs Review</span>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 ml-1">
                  {suggestions.length}
                </Badge>
              </CardTitle>
              <Link href="/payments">
                <Button variant="ghost" size="sm" className="text-orange-700 hover:text-orange-900 hover:bg-orange-100">
                  Review All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            <p className="text-sm text-orange-700/80">
              Emails that may need payment tracking
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {suggestions.slice(0, 3).map((suggestion) => (
              <div
                key={suggestion.id}
                className="flex items-start gap-3 p-2 rounded-md bg-white/60 border border-orange-100"
              >
                <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {suggestion.vendor_name_extracted || "Unknown Vendor"}
                    </span>
                    {suggestion.confidence === 'high' && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        High confidence
                      </Badge>
                    )}
                    {suggestion.amount_extracted && (
                      <Badge variant="outline" className="text-xs">
                        ${suggestion.amount_extracted.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {suggestion.email_subject || "(No subject)"}
                    </p>
                    <GmailViewLink subject={suggestion.email_subject || ""} />
                  </div>
                </div>
              </div>
            ))}
            {suggestions.length > 3 && (
              <Link href="/payments" className="block">
                <p className="text-sm text-orange-700 hover:text-orange-900 text-center py-1">
                  +{suggestions.length - 3} more to review
                </p>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Other Vendor Emails Section */}
      {hasOtherEmails && (
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowOtherEmails(!showOtherEmails)}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                Other Vendor Emails
                <Badge variant="secondary" className="ml-1">
                  {otherEmails.length}
                </Badge>
              </CardTitle>
              <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${showOtherEmails ? 'rotate-90' : ''}`} />
            </button>
          </CardHeader>
          {showOtherEmails && (
            <CardContent className="space-y-2 pt-0">
              {otherEmails.map((email, index) => (
                <details
                  key={index}
                  className="group rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <summary className="cursor-pointer list-none p-3 select-none">
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {email.vendorName || "Unknown"}
                          </span>
                          {email.isUrgent && (
                            <Badge variant="destructive" className="text-xs">
                              URGENT
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-muted-foreground truncate flex-1">
                            {email.subject}
                          </p>
                          <GmailViewLink subject={email.subject} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
                          {mounted ? formatDateTime(email.receivedAt) : ""}
                        </p>
                      </div>
                    </div>
                  </summary>
                  <div className="px-3 pb-3 border-t pt-3 mt-3">
                    {mounted && email.bodyHtml ? (
                      <div
                        className="text-sm text-muted-foreground prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.bodyHtml) }}
                      />
                    ) : email.snippet ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {email.snippet}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {mounted ? "No content available" : "Loading..."}
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
