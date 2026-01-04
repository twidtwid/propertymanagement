import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Edit,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  Check,
  CreditCard,
} from "lucide-react"
import { getPropertyTax, getActiveProperties } from "@/lib/actions"
import { formatDate, formatCurrency, daysUntil } from "@/lib/utils"
import { PAYMENT_STATUS_LABELS } from "@/types/database"
import { MarkTaxPaidButton, ConfirmTaxButton } from "@/components/payments/tax-actions"

function getStatusVariant(status: string, isOverdue: boolean): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (isOverdue) return "destructive"
  switch (status) {
    case "confirmed":
      return "success"
    case "sent":
      return "warning"
    case "pending":
      return "secondary"
    default:
      return "default"
  }
}

export default async function TaxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tax = await getPropertyTax(id)

  if (!tax) {
    notFound()
  }

  const days = daysUntil(tax.due_date)
  const isOverdue = tax.status === "pending" && days < 0
  const statusVariant = getStatusVariant(tax.status, isOverdue)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/payments/taxes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tax.jurisdiction} Q{tax.installment} - {tax.tax_year}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={statusVariant}>
              {isOverdue ? "Overdue" : PAYMENT_STATUS_LABELS[tax.status]}
            </Badge>
            {!isOverdue && days <= 7 && days >= 0 && tax.status === "pending" && (
              <Badge variant="warning">
                {days === 0 ? "Due Today" : `Due in ${days} days`}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <Link href={`/properties/${tax.property_id}`} className="hover:underline">
              {tax.property_name}
            </Link>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" variant="outline" asChild>
          <Link href={`/payments/taxes/${tax.id}/edit`}>
            <Edit className="h-5 w-5 mr-2" />
            Edit
          </Link>
        </Button>
        {tax.payment_url && (
          <Button size="lg" variant="outline" asChild>
            <a href={tax.payment_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-5 w-5 mr-2" />
              Pay Online
            </a>
          </Button>
        )}
        {tax.status === "pending" && (
          <MarkTaxPaidButton taxId={tax.id} />
        )}
        {tax.status === "sent" && (
          <ConfirmTaxButton taxId={tax.id} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(Number(tax.amount))}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{formatDate(tax.due_date)}</p>
                {isOverdue && (
                  <p className="text-sm text-red-600">{Math.abs(days)} days overdue</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={statusVariant} className="mt-1">
                  {isOverdue ? "Overdue" : PAYMENT_STATUS_LABELS[tax.status]}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Installment</p>
                <p className="font-medium">Q{tax.installment} of {tax.tax_year}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tax Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Jurisdiction</p>
                <p className="font-medium">{tax.jurisdiction}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tax Year</p>
                <p className="font-medium">{tax.tax_year}</p>
              </div>
              {tax.payment_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Payment Date</p>
                  <p className="font-medium">{formatDate(tax.payment_date)}</p>
                </div>
              )}
              {tax.confirmation_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Confirmation Date</p>
                  <p className="font-medium">{formatDate(tax.confirmation_date)}</p>
                </div>
              )}
            </div>
            {tax.payment_url && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Payment URL</p>
                <a
                  href={tax.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {tax.payment_url}
                </a>
              </div>
            )}
            {tax.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{tax.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
