"use client"

import Link from "next/link"
import { useState, useCallback } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Building2,
  Check,
  CreditCard,
  Loader2,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import type { PropertyTax, Property } from "@/types/database"
import { PAYMENT_STATUS_LABELS } from "@/types/database"
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils"
import { markPropertyTaxPaid, confirmPropertyTaxPayment } from "@/lib/mutations"
import { useToast } from "@/hooks/use-toast"

interface TaxTableProps {
  taxes: (PropertyTax & { property_name?: string })[]
  properties: Property[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

function getStatusVariant(status: string, isOverdue: boolean): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (isOverdue) return "destructive"
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

const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "auto_pay", label: "Auto Pay" },
  { value: "online", label: "Online" },
  { value: "wire", label: "Wire Transfer" },
  { value: "other", label: "Other" },
]

function MarkTaxPaidButton({ taxId }: { taxId: string }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const { toast } = useToast()
  const router = useRouter()

  const handleSubmit = async () => {
    if (!paymentDate) {
      toast({ title: "Error", description: "Please enter a payment date", variant: "destructive" })
      return
    }

    setIsLoading(true)
    const result = await markPropertyTaxPaid(taxId, paymentDate, paymentMethod || undefined)
    setIsLoading(false)

    if (result.success) {
      toast({ title: "Marked as paid", description: "The tax payment has been marked as sent." })
      setOpen(false)
      router.refresh()
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CreditCard className="h-4 w-4 mr-1" />
          Mark Paid
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Mark Tax Payment as Sent</DialogTitle>
          <DialogDescription>
            Enter the payment date and method.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="paymentMethod">
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
            Mark Paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmTaxButton({ taxId }: { taxId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleConfirm = async () => {
    setIsLoading(true)
    const result = await confirmPropertyTaxPayment(taxId)
    setIsLoading(false)

    if (result.success) {
      toast({ title: "Payment confirmed", description: "The tax payment has been confirmed." })
      router.refresh()
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleConfirm} disabled={isLoading}>
      {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
      Confirm
    </Button>
  )
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
      // Toggle order
      params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to desc
      params.set('sortBy', column)
      params.set('sortOrder', 'desc')
    }
    router.push(`/payments/taxes?${params.toString()}`)
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

export function TaxTable({ taxes, sortBy, sortOrder }: TaxTableProps) {
  if (taxes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No property taxes found.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader column="property_name" label="Property" currentSort={sortBy} currentOrder={sortOrder} />
          <SortableHeader column="jurisdiction" label="Jurisdiction" currentSort={sortBy} currentOrder={sortOrder} />
          <SortableHeader column="tax_year" label="Year / Quarter" currentSort={sortBy} currentOrder={sortOrder} />
          <SortableHeader column="due_date" label="Due Date" currentSort={sortBy} currentOrder={sortOrder} />
          <SortableHeader column="amount" label="Amount" currentSort={sortBy} currentOrder={sortOrder} className="text-right" />
          <SortableHeader column="status" label="Status" currentSort={sortBy} currentOrder={sortOrder} />
          <TableHead className="w-[180px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {taxes.map((tax) => {
          const days = daysUntil(tax.due_date)
          const isOverdue = tax.status === "pending" && days < 0
          const statusVariant = getStatusVariant(tax.status, isOverdue)
          const propertyName = tax.property_name || (tax.property as any)?.name || "Unknown"

          return (
            <TableRow
              key={tax.id}
              className={isOverdue ? "bg-red-50/50" : ""}
            >
              <TableCell>
                <Link
                  href={`/payments/taxes/${tax.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{propertyName}</span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/payments/taxes/${tax.id}`} className="hover:underline">
                  {tax.jurisdiction}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/payments/taxes/${tax.id}`} className="hover:underline">
                  {tax.tax_year} Q{tax.installment}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/payments/taxes/${tax.id}`} className="hover:underline">
                  <div className="flex items-center gap-2">
                    <span>{formatDate(tax.due_date)}</span>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
                    )}
                    {!isOverdue && days <= 7 && days >= 0 && tax.status === "pending" && (
                      <Badge variant="warning" className="text-xs">
                        {days === 0 ? "Today" : `${days}d`}
                      </Badge>
                    )}
                  </div>
                </Link>
              </TableCell>
              <TableCell className="text-right font-medium">
                <Link href={`/payments/taxes/${tax.id}`} className="hover:underline">
                  {formatCurrency(Number(tax.amount))}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant}>
                  {PAYMENT_STATUS_LABELS[tax.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {tax.payment_url && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={tax.payment_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {tax.status === "pending" && (
                    <MarkTaxPaidButton taxId={tax.id} />
                  )}
                  {tax.status === "sent" && (
                    <ConfirmTaxButton taxId={tax.id} />
                  )}
                  {tax.status === "confirmed" && (
                    <Check className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
