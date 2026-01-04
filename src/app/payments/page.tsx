import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getAllPayments,
  getPaymentsNeedingAttention,
  getPaymentsAwaitingConfirmation,
  getActiveProperties,
  getActiveVehicles,
  getSmartAndUserPins,
  getPinNotesByEntities,
  getUserPinNote,
  getPendingPaymentSuggestions,
  getPaymentEmailLinks,
} from "@/lib/actions"
import { getUser } from "@/lib/auth"
import { PaymentsWithPins } from "@/components/payments/payments-with-pins"
import { QuickActions } from "@/components/payments/quick-actions"
import { AwaitingConfirmation } from "@/components/payments/awaiting-confirmation"
import { AddBillButton } from "@/components/payments/add-bill-button"
import { BankImportDialog } from "@/components/payments/bank-import-dialog"
import { EmailSuggestionsInbox } from "@/components/payments/email-suggestions-inbox"

interface PaymentsPageProps {
  searchParams: Promise<{
    category?: string
    status?: string
    propertyId?: string
    search?: string
    dateRange?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }>
}

async function PaymentsContentWrapper({ searchParams }: PaymentsPageProps) {
  const params = await searchParams

  const [payments, attentionPayments, awaitingConfirmation, properties, vehicles, billPins, taxPins, insurancePins, paymentSuggestions, user] = await Promise.all([
    getAllPayments({
      category: params.category,
      status: params.status,
      propertyId: params.propertyId,
      search: params.search,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
    getPaymentsNeedingAttention(),
    getPaymentsAwaitingConfirmation(),
    getActiveProperties(),
    getActiveVehicles(),
    getSmartAndUserPins('bill'),
    getSmartAndUserPins('property_tax'),
    getSmartAndUserPins('insurance_premium'),
    getPendingPaymentSuggestions(),
    getUser(),
  ])

  // Merge pins from all payment sources
  const pins = {
    smartPins: new Set([
      ...Array.from(billPins.smartPins),
      ...Array.from(taxPins.smartPins),
      ...Array.from(insurancePins.smartPins),
    ]),
    userPins: new Set([
      ...Array.from(billPins.userPins),
      ...Array.from(taxPins.userPins),
      ...Array.from(insurancePins.userPins),
    ]),
  }

  // Load notes for all pinned payments across all entity types
  const [billNotesMap, taxNotesMap, insuranceNotesMap] = await Promise.all([
    getPinNotesByEntities('bill', Array.from(billPins.smartPins).concat(Array.from(billPins.userPins))),
    getPinNotesByEntities('property_tax', Array.from(taxPins.smartPins).concat(Array.from(taxPins.userPins))),
    getPinNotesByEntities('insurance_premium', Array.from(insurancePins.smartPins).concat(Array.from(insurancePins.userPins))),
  ])

  // Merge all notes into a single map by source_id
  const notesMap = new Map([
    ...Array.from(billNotesMap.entries()),
    ...Array.from(taxNotesMap.entries()),
    ...Array.from(insuranceNotesMap.entries()),
  ])

  // Load user notes for all pinned payments
  const userNotesMap = new Map()
  if (user) {
    const allPinnedIds = [...Array.from(pins.smartPins), ...Array.from(pins.userPins)]
    for (const payment of payments.filter(p => allPinnedIds.includes(p.source_id))) {
      const entityType =
        payment.source === 'bill' ? 'bill' :
        payment.source === 'property_tax' ? 'property_tax' :
        'insurance_premium'
      const userNote = await getUserPinNote(entityType, payment.source_id, user.id)
      if (userNote) {
        userNotesMap.set(payment.source_id, userNote)
      }
    }
  }

  // Fetch email links for all bill payments
  const billPayments = payments.filter(p => p.source === 'bill')
  const emailLinksMapRaw = await getPaymentEmailLinks(
    'bill',
    billPayments.map(p => p.source_id)
  )
  const emailLinksMap = Object.fromEntries(emailLinksMapRaw)

  // Also load notes for payments needing attention (smart pins shown in QuickActions)
  const attentionNotesMap = new Map()
  const attentionUserNotesMap = new Map()
  if (user) {
    for (const payment of attentionPayments) {
      const entityType =
        payment.source === 'bill' ? 'bill' :
        payment.source === 'property_tax' ? 'property_tax' :
        'insurance_premium'

      // Get all notes for this entity
      const notes = notesMap.get(payment.source_id)
      if (notes) {
        attentionNotesMap.set(payment.source_id, notes)
      }

      // Get user's note for this entity
      const userNote = await getUserPinNote(entityType, payment.source_id, user.id)
      if (userNote) {
        attentionUserNotesMap.set(payment.source_id, userNote)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Payments</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track all bills, taxes, and payment confirmations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BankImportDialog />
          <AddBillButton properties={properties} vehicles={vehicles} />
        </div>
      </div>

      {/* Email Suggestions - review payment-related emails */}
      <EmailSuggestionsInbox
        suggestions={paymentSuggestions}
        properties={properties}
        vehicles={vehicles}
      />

      {/* Smart Pins - auto-generated based on urgency */}
      <QuickActions
        paymentsNeedingAttention={attentionPayments}
        initialNotesMap={Object.fromEntries(attentionNotesMap)}
        initialUserNotesMap={Object.fromEntries(attentionUserNotesMap)}
      />

      <AwaitingConfirmation payments={awaitingConfirmation} />

      {/* User Pins (before filters) + Filters + Unpinned payments (after filters) */}
      <PaymentsWithPins
        payments={payments}
        properties={properties}
        initialSmartPins={Array.from(pins.smartPins)}
        initialUserPins={Array.from(pins.userPins)}
        initialNotesMap={Object.fromEntries(notesMap)}
        initialUserNotesMap={Object.fromEntries(userNotesMap)}
        emailLinksMap={emailLinksMap}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
      />
    </div>
  )
}

function PaymentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 flex-1" />
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function PaymentsPage(props: PaymentsPageProps) {
  return (
    <Suspense fallback={<PaymentsLoading />}>
      <PaymentsContentWrapper searchParams={props.searchParams} />
    </Suspense>
  )
}
