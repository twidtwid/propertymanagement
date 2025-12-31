"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Paperclip, ExternalLink } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { VendorCommunication } from "@/lib/actions"

interface EmailPreviewProps {
  communication: VendorCommunication
}

export function EmailPreview({ communication }: EmailPreviewProps) {
  const formatDateTime = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  return (
    <div className="border-t bg-muted/30">
      <div className="p-4 space-y-4">
        {/* Email Headers */}
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="w-20 text-muted-foreground">From:</span>
            <span className="font-medium">{communication.from_email}</span>
          </div>
          <div className="flex">
            <span className="w-20 text-muted-foreground">To:</span>
            <span className="font-medium">{communication.to_email}</span>
          </div>
          <div className="flex">
            <span className="w-20 text-muted-foreground">Date:</span>
            <span>{formatDateTime(communication.received_at)}</span>
          </div>
          <div className="flex">
            <span className="w-20 text-muted-foreground">Subject:</span>
            <span className="font-medium">{communication.subject || "(No subject)"}</span>
          </div>
        </div>

        {/* Labels */}
        {communication.labels && communication.labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Labels:</span>
            {communication.labels.map((label) => (
              <Badge key={label} variant="outline" className="text-xs">
                {label.replace("CATEGORY_", "").toLowerCase()}
              </Badge>
            ))}
          </div>
        )}

        {/* Attachments */}
        {communication.has_attachment && communication.attachment_names && communication.attachment_names.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              <span>Attachments ({communication.attachment_names.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {communication.attachment_names.map((name, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Email Body */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {communication.body_html ? (
            <div
              className="email-content"
              dangerouslySetInnerHTML={{ __html: communication.body_html }}
            />
          ) : communication.body_snippet ? (
            <p className="whitespace-pre-wrap">{communication.body_snippet}</p>
          ) : (
            <p className="text-muted-foreground italic">No content available</p>
          )}
        </div>

        {/* Gmail Link */}
        {communication.gmail_message_id && (
          <div className="pt-2">
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${communication.gmail_message_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View in Gmail
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
