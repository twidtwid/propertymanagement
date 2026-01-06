"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GmailViewLink } from "@/components/ui/gmail-view-link"
import { Zap, Check, ArrowRight, Mail, Building2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

interface AutoPayConfirmation {
  payment_id: string
  payment_type: 'bill' | 'property_tax' | 'insurance_premium'
  description: string
  amount: number
  property_name: string | null
  vendor_name: string | null
  confirmation_date: string
  email_subject: string
  email_snippet: string | null
}

interface AutoPayConfirmationsProps {
  confirmations: AutoPayConfirmation[]
}

export function AutoPayConfirmations({ confirmations }: AutoPayConfirmationsProps) {
  const [isOpen, setIsOpen] = useState(true) // Default to open

  const totalAmount = confirmations.reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <div className="flex items-center gap-1">
            <Zap className="h-5 w-5" />
            <Check className="h-4 w-4 -ml-2" />
          </div>
          Auto-Pays Processed
          <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
            {confirmations.length}
          </Badge>
        </CardTitle>
        <Link
          href="/payments?status=confirmed"
          className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {confirmations.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">
            No auto-pay confirmations this week
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between p-2 rounded bg-green-100 text-green-800">
              <span className="text-sm font-medium">
                {confirmations.length} payment{confirmations.length > 1 ? "s" : ""} confirmed this week
              </span>
              <span className="text-sm font-semibold">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {/* Expandable details */}
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-sm text-green-700 hover:text-green-900">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  {isOpen ? 'Hide' : 'Show'} details
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {confirmations.map((confirmation) => (
              <div
                key={confirmation.payment_id}
                className="p-3 rounded-lg bg-white border border-green-100"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{confirmation.description}</span>
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Confirmed
                      </Badge>
                    </div>
                    {confirmation.property_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {confirmation.property_name}
                      </div>
                    )}
                    {confirmation.vendor_name && (
                      <div className="text-xs text-muted-foreground">
                        {confirmation.vendor_name}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">
                      {formatCurrency(Number(confirmation.amount))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(confirmation.confirmation_date)}
                    </div>
                  </div>
                </div>

                {/* Email confirmation link */}
                <div className="mt-2 pt-2 border-t border-green-100">
                  <div className="flex items-center gap-2 text-xs text-green-700">
                    <Mail className="h-3 w-3" />
                    <span className="truncate flex-1">{confirmation.email_subject}</span>
                    <GmailViewLink subject={confirmation.email_subject} />
                  </div>
                </div>
              </div>
            ))}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  )
}
