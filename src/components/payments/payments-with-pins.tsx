"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PaymentTable } from "./payment-table"
import { PinnedSection } from "@/components/ui/pinned-section"
import { PaymentFilters } from "./payment-filters"
import { PinNotes } from "@/components/ui/pin-notes"
import { ChevronRight, Zap } from "lucide-react"
import type { UnifiedPayment, Property, PinNote } from "@/types/database"

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

interface PaymentsWithPinsProps {
  payments: UnifiedPayment[]
  properties: Property[]
  initialSmartPins: string[]
  initialUserPins: string[]
  initialNotesMap: Record<string, PinNote[]>
  initialUserNotesMap: Record<string, PinNote>
  emailLinksMap?: Record<string, LinkedEmail[]>
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
  emailLinksMap,
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

  // Separate auto-pay insurance premiums from regular payments
  const isAutoPayInsurance = (p: UnifiedPayment) =>
    p.source === 'insurance_premium' && p.payment_method === 'auto_pay'

  // Separate into user pins and unpinned
  const userPinPayments = payments.filter(p => !smartPins.has(p.source_id) && userPins.has(p.source_id))
  const unpinnedPayments = payments.filter(p => !allPinnedIds.has(p.source_id) && !isAutoPayInsurance(p))
  const autoPayInsurance = payments.filter(p => !allPinnedIds.has(p.source_id) && isAutoPayInsurance(p))

  // Group auto-pay insurance by carrier
  const groupedAutoPayInsurance = autoPayInsurance.reduce((acc, p) => {
    // Extract carrier name from description (format: "Carrier - Type")
    const carrier = p.description.split(' - ')[0] || 'Other'
    if (!acc[carrier]) {
      acc[carrier] = { payments: [], totalAmount: 0, dueDate: p.due_date }
    }
    acc[carrier].payments.push(p)
    acc[carrier].totalAmount += Number(p.amount)
    return acc
  }, {} as Record<string, { payments: UnifiedPayment[]; totalAmount: number; dueDate: string }>)

  const [showAutoPaySection, setShowAutoPaySection] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)

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
            emailLinksMap={emailLinksMap}
          />
        </PinnedSection>
      )}

      {/* Filters */}
      <PaymentFilters properties={properties} />

      {/* All unpinned payments (shown AFTER filters) */}
      <Card>
        <CardHeader className="pb-2">
          <button
            onClick={() => setShowAllPayments(!showAllPayments)}
            className="flex items-center justify-between w-full text-left"
          >
            <CardTitle className="text-base flex items-center gap-2">
              All Payments
              <Badge variant="secondary">
                {unpinnedPayments.length}
              </Badge>
            </CardTitle>
            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${showAllPayments ? 'rotate-90' : ''}`} />
          </button>
        </CardHeader>
        {showAllPayments && (
          <CardContent className="pt-0">
            <PaymentTable
              payments={unpinnedPayments}
              pinnedIds={allPinnedIds}
              onTogglePin={handleTogglePin}
              userNotesMap={userNotesMap}
              onNoteSaved={refreshNotes}
              notesMap={notesMap}
              emailLinksMap={emailLinksMap}
              sortBy={sortBy}
              sortOrder={sortOrder}
            />
          </CardContent>
        )}
      </Card>

      {/* Scheduled Auto-Pays (collapsed by default) */}
      {autoPayInsurance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowAutoPaySection(!showAutoPaySection)}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                Scheduled Auto-Pays
                <Badge variant="secondary" className="ml-1">
                  {Object.keys(groupedAutoPayInsurance).length} carrier{Object.keys(groupedAutoPayInsurance).length !== 1 ? 's' : ''}
                </Badge>
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ${autoPayInsurance.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString()}/yr total
                </span>
              </CardTitle>
              <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${showAutoPaySection ? 'rotate-90' : ''}`} />
            </button>
          </CardHeader>
          {showAutoPaySection && (
            <CardContent className="pt-0">
              <div className="space-y-3">
                {Object.entries(groupedAutoPayInsurance).map(([carrier, data]) => (
                  <div key={carrier} className="p-3 rounded-lg bg-muted/30 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{carrier}</span>
                        <Badge variant="outline" className="text-xs">
                          {data.payments.length} {data.payments.length === 1 ? 'policy' : 'policies'}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">${data.totalAmount.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">/yr</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {data.payments.map((p, i) => (
                        <span key={p.source_id}>
                          {p.property_name || p.vehicle_name || p.description.split(' - ')[1]}
                          {i < data.payments.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Next renewal: {new Date(data.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </>
  )
}
