"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Clock, CreditCard, Mail, ExternalLink } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"

interface UpcomingAutopay {
  id: string
  email_id: string
  vendor_id: string
  vendor_name: string
  amount: number | null
  payment_date: string | null
  description: string
  email_subject: string
  email_snippet: string | null
  email_received_at: string
  confidence: 'high' | 'medium' | 'low'
}

interface UpcomingAutopaysProps {
  autopays: UpcomingAutopay[]
}

// Hydration-safe date formatting
function useRelativeDate(dateStr: string | null, receivedAt: string): string {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Before hydration, show generic text to avoid mismatch
  if (!mounted) {
    return "Upcoming"
  }

  if (!dateStr) {
    // If no payment date, estimate based on when email was received
    const received = new Date(receivedAt)
    const now = new Date()
    const daysSinceReceived = Math.floor((now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceReceived === 0) return "Today or tomorrow"
    if (daysSinceReceived === 1) return "Likely processed"
    return "Check status"
  }

  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "Likely processed"
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays <= 7) return `In ${diffDays} days`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Component for individual autopay item with its own hydration state
function AutopayItem({ autopay }: { autopay: UpcomingAutopay }) {
  const relativeDate = useRelativeDate(autopay.payment_date, autopay.email_received_at)

  return (
    <div className="p-3 rounded-lg bg-white border border-blue-100">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{autopay.vendor_name}</span>
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
              suppressHydrationWarning
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              {relativeDate}
            </Badge>
          </div>
          {autopay.description && autopay.description !== autopay.email_subject && (
            <div className="text-xs text-muted-foreground">
              {autopay.description}
            </div>
          )}
        </div>
        <div className="text-right">
          {autopay.amount && (
            <div className="font-medium text-sm">
              {formatCurrency(autopay.amount)}
            </div>
          )}
        </div>
      </div>

      {/* Email source with View Email link */}
      <div className="mt-2 pt-2 border-t border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-blue-700 flex-1 min-w-0">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{autopay.email_subject}</span>
          </div>
          <a
            href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(autopay.email_subject)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 ml-2 flex-shrink-0"
            title="Search in Gmail"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">View</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export function UpcomingAutopays({ autopays }: UpcomingAutopaysProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (autopays.length === 0) {
    return null
  }

  const totalAmount = autopays.reduce((sum, a) => sum + (a.amount || 0), 0)

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <div className="flex items-center gap-1">
            <CreditCard className="h-5 w-5" />
            <Clock className="h-4 w-4 -ml-2" />
          </div>
          Autopays Coming Up
          <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
            {autopays.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="flex items-center justify-between p-2 rounded bg-blue-100 text-blue-800">
          <span className="text-sm font-medium">
            {autopays.length} autopay{autopays.length > 1 ? "s" : ""} scheduled
          </span>
          {totalAmount > 0 && (
            <span className="text-sm font-semibold">
              ~{formatCurrency(totalAmount)}
            </span>
          )}
        </div>

        {/* Expandable details */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900">
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              {isOpen ? 'Hide' : 'Show'} details
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {autopays.map((autopay) => (
              <AutopayItem key={autopay.id} autopay={autopay} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
