"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PinnedSection } from "@/components/ui/pinned-section"
import { PaymentTable } from "./payment-table"
import { Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { confirmBillPayment } from "@/lib/mutations"
import type { UnifiedPayment } from "@/types/database"

interface QuickActionsProps {
  paymentsNeedingAttention: UnifiedPayment[]
}

export function QuickActions({ paymentsNeedingAttention }: QuickActionsProps) {
  const [isConfirmingAll, setIsConfirmingAll] = useState(false)
  const { toast } = useToast()

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
    <>
      <PinnedSection count={paymentsNeedingAttention.length} title="Smart Pins" variant="smart">
        <PaymentTable
          payments={paymentsNeedingAttention}
          pinnedIds={new Set(paymentsNeedingAttention.map((p) => p.source_id))}
        />
      </PinnedSection>

      {unconfirmedChecks.some((p) => p.source === "bill") && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleConfirmAll} disabled={isConfirmingAll}>
            {isConfirmingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Confirm All Unconfirmed Checks ({unconfirmedChecks.filter((p) => p.source === "bill").length})
          </Button>
        </div>
      )}
    </>
  )
}
