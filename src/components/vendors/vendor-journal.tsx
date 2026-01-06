"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Mail,
  Paperclip,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import type { VendorCommunication } from "@/lib/actions"
import { EmailPreview } from "./email-preview"
import { GmailViewLink } from "@/components/ui/gmail-view-link"

interface VendorJournalProps {
  communications: VendorCommunication[]
}

export function VendorJournal({ communications }: VendorJournalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (communications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No email communications yet</p>
        <p className="text-sm mt-1">
          Emails will appear here once synced from Gmail
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {communications.map((comm) => (
        <div
          key={comm.id}
          className={`rounded-xl border transition-colors ${
            comm.is_important ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : ""
          }`}
        >
          <div
            className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50"
            onClick={() => setExpandedId(expandedId === comm.id ? null : comm.id)}
          >
            <div className="mt-1">
              {comm.direction === "inbound" ? (
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                  <ArrowDownLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              ) : (
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                  <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {comm.subject || "(No subject)"}
                </span>
                {comm.is_important && (
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                )}
                {comm.has_attachment && (
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <GmailViewLink subject={comm.subject || ""} />
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span className="truncate">
                  {comm.direction === "inbound" ? `From: ${comm.from_email}` : `To: ${comm.to_email}`}
                </span>
              </div>
              {comm.body_snippet && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {comm.body_snippet}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground">
                {formatDateTime(comm.received_at)}
              </span>
              <div className="flex items-center gap-1">
                <Badge variant={comm.direction === "inbound" ? "secondary" : "outline"}>
                  {comm.direction === "inbound" ? "Received" : "Sent"}
                </Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {expandedId === comm.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {expandedId === comm.id && (
            <EmailPreview communication={comm} />
          )}
        </div>
      ))}
    </div>
  )
}
