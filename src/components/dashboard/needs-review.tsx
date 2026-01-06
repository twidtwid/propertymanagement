"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GmailViewLink } from "@/components/ui/gmail-view-link"
import { Inbox, ChevronRight, AlertCircle } from "lucide-react"
import type { PaymentSuggestion } from "@/types/database"

interface NeedsReviewProps {
  suggestions: PaymentSuggestion[]
}

export function NeedsReview({ suggestions }: NeedsReviewProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
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
          <Link
            key={suggestion.id}
            href="/payments"
            className="flex items-start gap-3 p-2 rounded-md bg-white/60 border border-orange-100 hover:bg-white hover:border-orange-200 transition-colors cursor-pointer"
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
          </Link>
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
  )
}
