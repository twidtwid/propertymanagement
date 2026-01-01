"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Clock,
  Check,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { confirmBillPayment } from "@/lib/mutations"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { UnifiedPayment } from "@/types/database"

interface AwaitingConfirmationProps {
  payments: UnifiedPayment[]
}

export function AwaitingConfirmation({ payments }: AwaitingConfirmationProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isConfirming, setIsConfirming] = useState(false)
  const { toast } = useToast()

  if (payments.length === 0) {
    return null
  }

  const urgentPayments = payments.filter((p) => (p.days_waiting || 0) > 14)
  const recentPayments = payments.filter((p) => (p.days_waiting || 0) <= 14)

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    if (selectedIds.size === payments.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(payments.map((p) => p.source_id)))
    }
  }

  const handleConfirmSelected = async () => {
    if (selectedIds.size === 0) return

    setIsConfirming(true)
    let successCount = 0
    let errorCount = 0

    for (const id of Array.from(selectedIds)) {
      const result = await confirmBillPayment(id)
      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
    }

    setIsConfirming(false)
    setSelectedIds(new Set())

    if (errorCount === 0) {
      toast({
        title: "Payments confirmed",
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

  const handleConfirmSingle = async (id: string) => {
    setIsConfirming(true)
    const result = await confirmBillPayment(id)
    setIsConfirming(false)

    if (result.success) {
      toast({
        title: "Payment confirmed",
        description: "The payment has been marked as confirmed.",
      })
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to confirm payment",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Clock className="h-5 w-5" />
            Awaiting Confirmation
            <Badge variant="secondary" className="ml-2">
              {payments.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {urgentPayments.length > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {urgentPayments.length} &gt;14 days
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Payments that have been sent but not yet confirmed as received
        </p>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Bulk actions */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === payments.length && payments.length > 0}
                  onCheckedChange={selectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : "Select all"}
                </span>
              </div>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleConfirmSelected}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirm Selected ({selectedIds.size})
                </Button>
              )}
            </div>

            {/* Urgent payments (>14 days) */}
            {urgentPayments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Urgent - Over 14 Days
                </h4>
                <div className="space-y-2">
                  {urgentPayments.map((payment) => (
                    <PaymentRow
                      key={payment.source_id}
                      payment={payment}
                      isSelected={selectedIds.has(payment.source_id)}
                      onSelect={() => toggleSelection(payment.source_id)}
                      onConfirm={() => handleConfirmSingle(payment.source_id)}
                      isConfirming={isConfirming}
                      isUrgent
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent payments (<=14 days) */}
            {recentPayments.length > 0 && (
              <div className="space-y-2">
                {urgentPayments.length > 0 && (
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Recent (within 14 days)
                  </h4>
                )}
                <div className="space-y-2">
                  {recentPayments.map((payment) => (
                    <PaymentRow
                      key={payment.source_id}
                      payment={payment}
                      isSelected={selectedIds.has(payment.source_id)}
                      onSelect={() => toggleSelection(payment.source_id)}
                      onConfirm={() => handleConfirmSingle(payment.source_id)}
                      isConfirming={isConfirming}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface PaymentRowProps {
  payment: UnifiedPayment
  isSelected: boolean
  onSelect: () => void
  onConfirm: () => void
  isConfirming: boolean
  isUrgent?: boolean
}

function PaymentRow({
  payment,
  isSelected,
  onSelect,
  onConfirm,
  isConfirming,
  isUrgent,
}: PaymentRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        isUrgent
          ? "border-red-200 bg-red-50/50"
          : "border-gray-200 bg-white"
      }`}
    >
      <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{payment.description}</span>
          {payment.payment_method === "check" && (
            <Badge variant="outline" className="text-xs">
              Check
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {payment.vendor_name && <span>{payment.vendor_name} · </span>}
          {payment.property_name && <span>{payment.property_name} · </span>}
          Sent {formatDate(payment.payment_date!)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-medium">{formatCurrency(Number(payment.amount))}</div>
          <div
            className={`text-sm ${
              isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"
            }`}
          >
            {payment.days_waiting}d waiting
          </div>
        </div>
        <Button
          size="sm"
          variant={isUrgent ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
