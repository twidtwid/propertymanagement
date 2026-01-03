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
} from "@/lib/actions"
import { PaymentFilters } from "@/components/payments/payment-filters"
import { PaymentsContent } from "@/components/payments/payments-content"
import { QuickActions } from "@/components/payments/quick-actions"
import { AwaitingConfirmation } from "@/components/payments/awaiting-confirmation"
import { AddBillButton } from "@/components/payments/add-bill-button"
import { BankImportDialog } from "@/components/payments/bank-import-dialog"

interface PaymentsPageProps {
  searchParams: Promise<{
    category?: string
    status?: string
    propertyId?: string
    search?: string
    dateRange?: string
  }>
}

async function PaymentsContentWrapper({ searchParams }: PaymentsPageProps) {
  const params = await searchParams

  const [payments, attentionPayments, awaitingConfirmation, properties, vehicles, pins] = await Promise.all([
    getAllPayments({
      category: params.category,
      status: params.status,
      propertyId: params.propertyId,
      search: params.search,
    }),
    getPaymentsNeedingAttention(),
    getPaymentsAwaitingConfirmation(),
    getActiveProperties(),
    getActiveVehicles(),
    getSmartAndUserPins('bill'),
  ])

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

      <QuickActions paymentsNeedingAttention={attentionPayments} />

      <AwaitingConfirmation payments={awaitingConfirmation} />

      <PaymentFilters properties={properties} />

      <PaymentsContent
        payments={payments}
        initialSmartPins={Array.from(pins.smartPins)}
        initialUserPins={Array.from(pins.userPins)}
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
