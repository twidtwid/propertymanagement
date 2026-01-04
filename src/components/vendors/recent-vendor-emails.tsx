"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { VendorCommunication } from "@/lib/actions"

interface RecentVendorEmailsProps {
  communications: VendorCommunication[]
}

// Sanitize email HTML to prevent style bleeding
function sanitizeEmailHtml(html: string): string {
  // Remove <style> tags and their content
  let sanitized = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  // Remove <link> tags (stylesheets, fonts, etc.)
  sanitized = sanitized.replace(/<link[^>]*>/gi, '')
  return sanitized
}

export function RecentVendorEmails({ communications }: RecentVendorEmailsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter to last 7 days only - use useMemo with mounted to avoid hydration mismatch
  const recentEmails = useMemo(() => {
    if (!mounted) return communications.slice(0, 10) // Show all on server, filter on client
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return communications.filter((email) => {
      const receivedAt = new Date(email.received_at)
      return receivedAt >= sevenDaysAgo
    })
  }, [communications, mounted])

  if (recentEmails.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Recent Emails (Last 7 Days)
          <Badge variant="secondary" className="ml-2">
            {recentEmails.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentEmails.map((email) => {
          const urgentBadge = email.is_important

          return (
            <details
              key={email.id}
              className="group rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <summary className="cursor-pointer list-none p-3 select-none">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{email.subject || "(No subject)"}</p>
                      {urgentBadge && (
                        <Badge variant="destructive" className="text-xs">
                          URGENT
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {email.direction === "inbound" ? "Received" : "Sent"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                      {mounted ? formatDate(email.received_at) : ""}
                    </p>
                  </div>
                </div>
              </summary>
              <div className="px-3 pb-3 border-t pt-3 mt-3">
                {mounted && email.body_html ? (
                  <div
                    className="text-sm text-muted-foreground prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.body_html) }}
                  />
                ) : email.body_snippet ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {email.body_snippet}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {mounted ? "No content available" : "Loading..."}
                  </p>
                )}
              </div>
            </details>
          )
        })}
      </CardContent>
    </Card>
  )
}
