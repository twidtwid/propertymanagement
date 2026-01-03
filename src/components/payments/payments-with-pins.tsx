"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { PaymentTable } from "./payment-table"
import { PinnedSection } from "@/components/ui/pinned-section"
import { PaymentFilters } from "./payment-filters"
import type { UnifiedPayment } from "@/types/database"
import type { Property } from "@/types/database"

interface PaymentsWithPinsProps {
  payments: UnifiedPayment[]
  properties: Property[]
  initialSmartPins: string[]
  initialUserPins: string[]
}

export function PaymentsWithPins({
  payments,
  properties,
  initialSmartPins,
  initialUserPins,
}: PaymentsWithPinsProps) {
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

  // Separate into user pins and unpinned
  const userPinPayments = payments.filter(p => !smartPins.has(p.source_id) && userPins.has(p.source_id))
  const unpinnedPayments = payments.filter(p => !allPinnedIds.has(p.source_id))

  return (
    <>
      {/* User Pins - manually pinned items (shown BEFORE filters) */}
      {userPinPayments.length > 0 && (
        <PinnedSection count={userPinPayments.length} title="User Pins" variant="user">
          <PaymentTable
            payments={userPinPayments}
            pinnedIds={allPinnedIds}
            onTogglePin={handleTogglePin}
          />
        </PinnedSection>
      )}

      {/* Filters */}
      <PaymentFilters properties={properties} />

      {/* All unpinned payments (shown AFTER filters) */}
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
