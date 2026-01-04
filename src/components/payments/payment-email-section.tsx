"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Mail, ChevronDown, Check, FileText, Bell, ExternalLink } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { sanitizeEmailHtml } from "@/lib/email-utils"

interface LinkedEmail {
  id: string
  link_type: 'invoice' | 'confirmation' | 'reminder'
  email_id: string
  email_subject: string | null
  email_snippet: string | null
  email_received_at: string
  vendor_name: string | null
  email_body_html?: string | null
}

interface PaymentEmailSectionProps {
  emails: LinkedEmail[]
  className?: string
}

export function PaymentEmailSection({ emails, className }: PaymentEmailSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<LinkedEmail | null>(null)

  if (emails.length === 0) return null

  const getLinkTypeIcon = (type: LinkedEmail['link_type']) => {
    switch (type) {
      case 'confirmation':
        return <Check className="h-3 w-3 text-green-600" />
      case 'invoice':
        return <FileText className="h-3 w-3 text-blue-600" />
      case 'reminder':
        return <Bell className="h-3 w-3 text-orange-600" />
    }
  }

  const getLinkTypeBadge = (type: LinkedEmail['link_type']) => {
    switch (type) {
      case 'confirmation':
        return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Confirmation</Badge>
      case 'invoice':
        return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Invoice</Badge>
      case 'reminder':
        return <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Reminder</Badge>
    }
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>{emails.length}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Linked Emails ({emails.length})
            </div>
            {emails.map((email) => (
              <div
                key={email.id}
                className="rounded-md bg-background border p-3 space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getLinkTypeIcon(email.link_type)}
                    {getLinkTypeBadge(email.link_type)}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(email.email_received_at)}
                    </span>
                  </div>
                </div>
                <p className="font-medium text-sm truncate">
                  {email.email_subject || "(No subject)"}
                </p>
                {email.email_snippet && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {email.email_snippet}
                  </p>
                )}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setSelectedEmail(email)}
                >
                  View Full Email <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Full Email Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedEmail?.email_subject || "(No subject)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {selectedEmail && getLinkTypeBadge(selectedEmail.link_type)}
              <span>From: {selectedEmail?.vendor_name || "Unknown"}</span>
              <span>{selectedEmail && formatDate(selectedEmail.email_received_at)}</span>
            </div>
            <div className="border rounded-lg p-4 bg-muted/30">
              {selectedEmail?.email_body_html ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeEmailHtml(selectedEmail.email_body_html)
                  }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {selectedEmail?.email_snippet || "No content available"}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Small mail icon button that shows count of linked emails
 * Used inline in payment table rows
 */
export function PaymentEmailIcon({
  count,
  onClick,
}: {
  count: number
  onClick?: () => void
}) {
  if (count === 0) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
      onClick={onClick}
      title={`${count} linked email${count > 1 ? 's' : ''}`}
    >
      <Mail className="h-4 w-4" />
    </Button>
  )
}
