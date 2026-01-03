"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { confirmBillPayment } from "@/lib/mutations"
import type { UnifiedPayment } from "@/types/database"
import { formatCurrency, formatDate } from "@/lib/utils"

interface QuickActionsProps {
  paymentsNeedingAttention: UnifiedPayment[]
}

export function QuickActions({ paymentsNeedingAttention }: QuickActionsProps) {
  const [isConfirmingAll, setIsConfirmingAll] = useState(false)
  const [expandedSection, setExpandedSection] = useState<"overdue" | "unconfirmed" | null>(null)
  const { toast } = useToast()

  const overduePayments = paymentsNeedingAttention.filter((p) => p.is_overdue)
  const unconfirmedChecks = paymentsNeedingAttention.filter(
    (p) => p.days_waiting !== null && p.days_waiting > 14
  )

  const handleConfirmAll = async () => {
    const billsToConfirm = unconfirmedChecks.filter((p) => p.source === "bill")
    if (billsToConfirm.length === 0) return

    setIsConfirmingAll(true)
    let successCount = 0
    let errorCount = 0

    for (const payment of billsToConfirm) {
      const result = await confirmBillPayment(payment.source_id)
      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
    }

    setIsConfirmingAll(false)

    if (errorCount === 0) {
      toast({
        title: "All payments confirmed",
        description: `${successCount} payment${successCount > 1 ? "s" : ""} confirmed successfully.`,
      })
    } else {
      toast({
        title: "Some payments not confirmed",
        description: `${successCount} confirmed, ${errorCount} failed.`,
        variant: "destructive",
      })
    }
  }

  if (paymentsNeedingAttention.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-900">Smart Pins</h3>
              <div className="flex gap-2">
                {overduePayments.length > 0 && (
                  <Badge variant="destructive">{overduePayments.length} Overdue</Badge>
                )}
                {unconfirmedChecks.length > 0 && (
                  <Badge variant="warning">{unconfirmedChecks.length} Unconfirmed</Badge>
                )}
              </div>
            </div>

            {overduePayments.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setExpandedSection(expandedSection === "overdue" ? null : "overdue")}
                  className="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800"
                >
                  {expandedSection === "overdue" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {overduePayments.length} overdue payment{overduePayments.length > 1 ? "s" : ""} (
                  {formatCurrency(overduePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0))})
                </button>
                {expandedSection === "overdue" && (
                  <div className="ml-6 space-y-2 border-l-2 border-red-200 pl-3">
                    {overduePayments.map((payment) => (
                      <div
                        key={`${payment.source}-${payment.source_id}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <div>
                          <span className="font-medium">{payment.description}</span>
                          {payment.property_name && (
                            <span className="text-muted-foreground"> · {payment.property_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            Due {formatDate(payment.due_date)}
                          </span>
                          <span className="font-medium">{formatCurrency(Number(payment.amount))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {unconfirmedChecks.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setExpandedSection(expandedSection === "unconfirmed" ? null : "unconfirmed")}
                  className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  {expandedSection === "unconfirmed" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {unconfirmedChecks.length} check{unconfirmedChecks.length > 1 ? "s" : ""} waiting confirmation
                  (&gt;14 days)
                </button>
                {expandedSection === "unconfirmed" && (
                  <div className="ml-6 space-y-2 border-l-2 border-amber-200 pl-3">
                    {unconfirmedChecks.map((payment) => (
                      <div
                        key={`${payment.source}-${payment.source_id}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <div>
                          <span className="font-medium">{payment.description}</span>
                          {payment.vendor_name && (
                            <span className="text-muted-foreground"> · {payment.vendor_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-amber-600 font-medium">
                            {payment.days_waiting}d waiting
                          </span>
                          <span className="font-medium">{formatCurrency(Number(payment.amount))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {unconfirmedChecks.some((p) => p.source === "bill") && (
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleConfirmAll}
                      disabled={isConfirmingAll}
                    >
                      {isConfirmingAll ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Confirm All ({unconfirmedChecks.filter((p) => p.source === "bill").length})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
