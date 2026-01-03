"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { PaymentTable } from "./payment-table"
import { PinnedSection } from "@/components/ui/pinned-section"
import type { UnifiedPayment } from "@/types/database"

interface PaymentsContentProps {
  payments: UnifiedPayment[]
  initialSmartPins: string[]
  initialUserPins: string[]
}

export function PaymentsContent({ payments, initialSmartPins, initialUserPins }: PaymentsContentProps) {
  const [smartPins, setSmartPins] = useState<Set<string>>(new Set(initialSmartPins))
  const [userPins, setUserPins] = useState<Set<string>>(new Set(initialUserPins))

  const allPinnedIds = new Set([...Array.from(smartPins), ...Array.from(userPins)])

  const handleTogglePin = (billId: string, isPinned: boolean) => {
    if (isPinned) {
      // Adding a pin - always goes to user pins
      setUserPins((prev) => new Set(prev).add(billId))
    } else {
      // Removing a pin - could be from either smart or user pins
      setSmartPins((prev) => {
        const next = new Set(prev)
        next.delete(billId)
        return next
      })
      setUserPins((prev) => {
        const next = new Set(prev)
        next.delete(billId)
        return next
      })
    }
  }

  // Separate into smart pins, user pins, and unpinned (only bills can be pinned)
  const smartPinPayments = payments.filter(p => p.source === 'bill' && smartPins.has(p.source_id))
  const userPinPayments = payments.filter(p => p.source === 'bill' && !smartPins.has(p.source_id) && userPins.has(p.source_id))
  const unpinnedPayments = payments.filter(p => p.source !== 'bill' || !allPinnedIds.has(p.source_id))

  return (
    <>
      {smartPinPayments.length > 0 && (
        <PinnedSection count={smartPinPayments.length} title="Smart Pins" variant="smart">
          <PaymentTable
            payments={smartPinPayments}
            pinnedIds={allPinnedIds}
            onTogglePin={handleTogglePin}
          />
        </PinnedSection>
      )}

      {userPinPayments.length > 0 && (
        <PinnedSection count={userPinPayments.length} title="User Pins" variant="user">
          <PaymentTable
            payments={userPinPayments}
            pinnedIds={allPinnedIds}
            onTogglePin={handleTogglePin}
          />
        </PinnedSection>
      )}

      <Card>
        <CardContent className="pt-6">
          <PaymentTable
            payments={unpinnedPayments}
            pinnedIds={allPinnedIds}
            onTogglePin={handleTogglePin}
          />
        </CardContent>
      </Card>
    </>
  )
}
