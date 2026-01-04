"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { PaymentTable } from "./payment-table"
import { PinnedSection } from "@/components/ui/pinned-section"
import { PaymentFilters } from "./payment-filters"
import { PinNotes } from "@/components/ui/pin-notes"
import type { UnifiedPayment, Property, PinNote } from "@/types/database"

interface PaymentsWithPinsProps {
  payments: UnifiedPayment[]
  properties: Property[]
  initialSmartPins: string[]
  initialUserPins: string[]
  initialNotesMap: Record<string, PinNote[]>
  initialUserNotesMap: Record<string, PinNote>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function PaymentsWithPins({
  payments,
  properties,
  initialSmartPins,
  initialUserPins,
  initialNotesMap,
  initialUserNotesMap,
  sortBy,
  sortOrder,
}: PaymentsWithPinsProps) {
  const [smartPins, setSmartPins] = useState<Set<string>>(new Set(initialSmartPins))
  const [userPins, setUserPins] = useState<Set<string>>(new Set(initialUserPins))
  const [notesMap, setNotesMap] = useState<Record<string, PinNote[]>>(initialNotesMap)
  const [userNotesMap, setUserNotesMap] = useState<Record<string, PinNote>>(initialUserNotesMap)

  const allPinnedIds = new Set([...Array.from(smartPins), ...Array.from(userPins)])

  // Refresh notes for a specific payment
  const refreshNotes = async (payment: UnifiedPayment) => {
    const entityType =
      payment.source === 'bill' ? 'bill' :
      payment.source === 'property_tax' ? 'property_tax' :
      'insurance_premium'
    try {
      const response = await fetch(`/api/pin-notes?entityType=${entityType}&entityId=${payment.source_id}`)
      if (response.ok) {
        const data = await response.json()
        setNotesMap((prev) => ({
          ...prev,
          [payment.source_id]: data.notes || [],
        }))
        setUserNotesMap((prev) => ({
          ...prev,
          [payment.source_id]: data.userNote || null,
        }))
      }
    } catch (error) {
      console.error("Failed to refresh notes:", error)
    }
  }

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
            userNotesMap={userNotesMap}
            onNoteSaved={refreshNotes}
            notesMap={notesMap}
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
            userNotesMap={userNotesMap}
            onNoteSaved={refreshNotes}
            notesMap={notesMap}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </CardContent>
      </Card>
    </>
  )
}
