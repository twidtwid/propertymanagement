"use client"

import Link from "next/link"
import { Fragment, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Car,
  Store,
  Check,
  Clock,
  AlertTriangle,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import type { UnifiedPayment } from "@/types/database"
import { BILL_TYPE_LABELS, PAYMENT_STATUS_LABELS } from "@/types/database"
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils"
import { ConfirmPaymentButton } from "./confirm-payment-button"
import { MarkPaidButton } from "./mark-paid-button"
import { PinButton } from "@/components/ui/pin-button"
import { PinNoteButton } from "@/components/ui/pin-note-button"
import { PinNotes } from "@/components/ui/pin-notes"
import { PaymentEmailSection } from "./payment-email-section"
import { Mail } from "lucide-react"
import type { PinNote } from "@/types/database"

interface LinkedEmail {
  id: string
  link_type: 'invoice' | 'confirmation' | 'reminder'
  email_id: string
  email_subject: string | null
  email_snippet: string | null
  email_received_at: string
  vendor_name: string | null
}

interface PaymentTableProps {
  payments: UnifiedPayment[]
  pinnedIds: Set<string>
  onTogglePin?: (billId: string, isPinned: boolean) => void
  userNotesMap?: Record<string, PinNote>
  onNoteSaved?: (payment: UnifiedPayment) => void
  notesMap?: Record<string, PinNote[]>
  emailLinksMap?: Record<string, LinkedEmail[]>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

function getStatusVariant(status: string, isOverdue: boolean, daysWaiting: number | null): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (isOverdue) return "destructive"
  if (daysWaiting && daysWaiting > 14) return "warning"
  switch (status) {
    case "confirmed":
      return "success"
    case "sent":
      return "warning"
    case "pending":
      return "secondary"
    case "overdue":
      return "destructive"
    default:
      return "default"
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "property_tax":
      return <Building2 className="h-4 w-4" />
    case "insurance":
      return <AlertTriangle className="h-4 w-4" />
    case "mortgage":
      return <Building2 className="h-4 w-4" />
    case "utility":
      return <Clock className="h-4 w-4" />
    default:
      return <Store className="h-4 w-4" />
  }
}

function SortableHeader({
  column,
  label,
  currentSort,
  currentOrder,
  className,
}: {
  column: string
  label: string
  currentSort?: string
  currentOrder?: 'asc' | 'desc'
  className?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSort = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    if (currentSort === column) {
      params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sortBy', column)
      params.set('sortOrder', 'desc')
    }
    router.push(`/payments?${params.toString()}`)
  }, [column, currentSort, currentOrder, router, searchParams])

  const isActive = currentSort === column
  const Icon = isActive
    ? currentOrder === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <TableHead className={className}>
      <button
        onClick={handleSort}
        className="flex items-center gap-1 hover:text-foreground transition-colors group"
      >
        {label}
        <Icon className={`h-4 w-4 ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
      </button>
    </TableHead>
  )
}

export function PaymentTable({ payments, pinnedIds, onTogglePin, userNotesMap, onNoteSaved, notesMap, emailLinksMap, sortBy, sortOrder }: PaymentTableProps) {

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No payments found matching your filters.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead className="w-10"></TableHead>
          <SortableHeader column="description" label="Description" currentSort={sortBy} currentOrder={sortOrder} className="w-[300px]" />
          <SortableHeader column="property_name" label="Property / Vehicle" currentSort={sortBy} currentOrder={sortOrder} />
          <SortableHeader column="due_date" label="Due Date" currentSort={sortBy} currentOrder={sortOrder} />
          <SortableHeader column="amount" label="Amount" currentSort={sortBy} currentOrder={sortOrder} className="text-right" />
          <SortableHeader column="status" label="Status" currentSort={sortBy} currentOrder={sortOrder} />
          <TableHead className="w-[50px]"></TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => {
          const days = daysUntil(payment.due_date)
          const statusVariant = getStatusVariant(
            payment.status,
            payment.is_overdue,
            payment.days_waiting
          )

          const isPinned = pinnedIds.has(payment.source_id)
          const entityType =
            payment.source === 'bill' ? 'bill' :
            payment.source === 'property_tax' ? 'property_tax' :
            'insurance_premium'
          const paymentNotes = notesMap?.[payment.source_id] || []
          const linkedEmails = emailLinksMap?.[payment.source_id] || []

          return (
            <Fragment key={`${payment.source}-${payment.source_id}`}>
            <TableRow
              className={payment.is_overdue ? "bg-red-50/50" : undefined}
            >
              <TableCell className="w-10">
                <PinButton
                  entityType={entityType}
                  entityId={payment.source_id}
                  isPinned={isPinned}
                  onToggle={onTogglePin ? (isPinned) => onTogglePin(payment.source_id, isPinned) : undefined}
                  metadata={{
                    title: payment.description,
                    amount: Number(payment.amount),
                    dueDate: payment.due_date,
                    status: payment.status,
                  }}
                />
              </TableCell>
              <TableCell className="w-10">
                {isPinned && (
                  <PinNoteButton
                    entityType={entityType}
                    entityId={payment.source_id}
                    existingNote={userNotesMap?.[payment.source_id]}
                    onNoteSaved={onNoteSaved ? () => onNoteSaved(payment) : undefined}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                  />
                )}
              </TableCell>
              <TableCell>
                {entityType === 'insurance_premium' ? (
                  <Link
                    href={`/insurance/${payment.source_id}`}
                    className="flex items-center gap-3 hover:text-primary transition-colors"
                  >
                    <div className="text-muted-foreground">
                      {getCategoryIcon(payment.category)}
                    </div>
                    <div>
                      <p className="font-medium hover:underline">{payment.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {BILL_TYPE_LABELS[payment.category]}
                        {payment.vendor_name && ` · ${payment.vendor_name}`}
                      </p>
                    </div>
                  </Link>
                ) : entityType === 'property_tax' ? (
                  <Link
                    href="/payments/taxes"
                    className="flex items-center gap-3 hover:text-primary transition-colors"
                  >
                    <div className="text-muted-foreground">
                      {getCategoryIcon(payment.category)}
                    </div>
                    <div>
                      <p className="font-medium hover:underline">{payment.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {BILL_TYPE_LABELS[payment.category]}
                        {payment.vendor_name && ` · ${payment.vendor_name}`}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground">
                      {getCategoryIcon(payment.category)}
                    </div>
                    <div>
                      <p className="font-medium">{payment.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {BILL_TYPE_LABELS[payment.category]}
                        {payment.vendor_name && ` · ${payment.vendor_name}`}
                      </p>
                    </div>
                  </div>
                )}
              </TableCell>
              <TableCell>
                {payment.property_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{payment.property_name}</span>
                  </div>
                )}
                {payment.vehicle_name && (
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span>{payment.vehicle_name}</span>
                  </div>
                )}
                {!payment.property_name && !payment.vehicle_name && (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span suppressHydrationWarning>{formatDate(payment.due_date)}</span>
                  {payment.is_overdue && (
                    <Badge variant="destructive" className="text-xs">
                      Overdue
                    </Badge>
                  )}
                  {!payment.is_overdue && days <= 7 && days >= 0 && (
                    <Badge variant="warning" className="text-xs">
                      {days === 0 ? "Today" : `${days}d`}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(Number(payment.amount))}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={statusVariant}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </Badge>
                    {payment.payment_method === "auto_pay" && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Zap className="h-3 w-3" />
                        Auto
                      </Badge>
                    )}
                  </div>
                  {payment.days_waiting !== null && payment.days_waiting > 0 && (
                    <span className="text-xs text-amber-600">
                      {payment.days_waiting}d waiting
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {linkedEmails.length > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="text-xs">{linkedEmails.length}</span>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {payment.status === "pending" && payment.source === "bill" && (
                    <MarkPaidButton billId={payment.source_id} source={payment.source} />
                  )}
                  {payment.status === "sent" && payment.source === "bill" && (
                    <ConfirmPaymentButton billId={payment.source_id} />
                  )}
                  {payment.status === "confirmed" && (
                    <Check className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </TableCell>
            </TableRow>
            {paymentNotes.length > 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-0 pb-3">
                  <PinNotes
                    notes={paymentNotes}
                    onNoteDeleted={() => onNoteSaved?.(payment)}
                  />
                </TableCell>
              </TableRow>
            )}
            {linkedEmails.length > 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-0 pb-3">
                  <PaymentEmailSection emails={linkedEmails} />
                </TableCell>
              </TableRow>
            )}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
