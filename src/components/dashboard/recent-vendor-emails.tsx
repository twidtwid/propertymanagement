"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface RecentVendorEmailsProps {
  emails: Array<{
    vendorName: string | null
    subject: string
    receivedAt: string
    isUrgent: boolean
    snippet?: string
    bodyHtml?: string
  }>
}

export function RecentVendorEmails({ emails }: RecentVendorEmailsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (emails.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Recent Vendor Emails (Last 7 Days)
          <Badge variant="secondary" className="ml-2">
            {emails.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {emails.map((email, index) => (
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
                  <p className="text-sm text-muted-foreground mt-1">
                    {email.subject}
                  </p>
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
                  dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
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
    </Card>
  )
}
