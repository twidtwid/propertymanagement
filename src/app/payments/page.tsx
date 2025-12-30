import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, CreditCard, Calendar, Check, AlertCircle } from "lucide-react"
import { getBills, getPropertyTaxes, getBillsNeedingConfirmation } from "@/lib/actions"
import { formatCurrency, formatDate, daysUntil, daysSince } from "@/lib/utils"
import { PAYMENT_STATUS_LABELS } from "@/types/database"

export default async function PaymentsPage() {
  const [bills, taxes, needsConfirmation] = await Promise.all([
    getBills(),
    getPropertyTaxes(),
    getBillsNeedingConfirmation(),
  ])

  const pendingBills = bills.filter((b) => b.status === "pending" || b.status === "sent")
  const confirmedBills = bills.filter((b) => b.status === "confirmed")

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Payments</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track bills, taxes, and payment confirmations
          </p>
        </div>
        <Button size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Add Bill
        </Button>
      </div>

      {needsConfirmation.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              Checks Needing Confirmation ({needsConfirmation.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base text-amber-700 mb-4">
              These payments were sent but haven&apos;t been confirmed as cashed.
              Verify with Bank of America.
            </p>
            <div className="space-y-3">
              {needsConfirmation.map((bill) => {
                const days = daysSince(bill.payment_date!)
                return (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-white"
                  >
                    <div>
                      <p className="text-base font-medium">
                        {bill.description || bill.bill_type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {bill.property?.name} - Sent {formatDate(bill.payment_date!)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-base font-semibold">
                          {formatCurrency(bill.amount)}
                        </p>
                        <Badge variant="destructive">
                          {days} days waiting
                        </Badge>
                      </div>
                      <Button size="sm">
                        <Check className="h-4 w-4 mr-1" />
                        Confirm
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Upcoming ({pendingBills.length})
          </TabsTrigger>
          <TabsTrigger value="taxes" className="gap-2">
            <Calendar className="h-4 w-4" />
            Property Taxes ({taxes.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Check className="h-4 w-4" />
            Payment History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Property/Vehicle</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingBills.map((bill) => {
                    const days = daysUntil(bill.due_date)
                    return (
                      <TableRow key={bill.id}>
                        <TableCell>
                          <p className="font-medium">
                            {bill.description || bill.bill_type}
                          </p>
                          {bill.vendor_id && (
                            <p className="text-sm text-muted-foreground">
                              Vendor payment
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {bill.property?.name ||
                            (bill.vehicle
                              ? `${bill.vehicle.year} ${bill.vehicle.make}`
                              : "-")}
                        </TableCell>
                        <TableCell>
                          <div>
                            {formatDate(bill.due_date)}
                            {days <= 7 && days >= 0 && (
                              <Badge variant="warning" className="ml-2">
                                {days === 0 ? "Today" : `${days}d`}
                              </Badge>
                            )}
                            {days < 0 && (
                              <Badge variant="destructive" className="ml-2">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(bill.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              bill.status === "pending"
                                ? "secondary"
                                : bill.status === "sent"
                                ? "warning"
                                : "default"
                            }
                          >
                            {PAYMENT_STATUS_LABELS[bill.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            Mark Paid
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes">
          <Card>
            <CardHeader>
              <CardTitle>Property Tax Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Year / Quarter</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxes.map((tax) => {
                    const days = daysUntil(tax.due_date)
                    return (
                      <TableRow key={tax.id}>
                        <TableCell className="font-medium">
                          {tax.property?.name}
                        </TableCell>
                        <TableCell>{tax.jurisdiction}</TableCell>
                        <TableCell>
                          {tax.tax_year} Q{tax.installment}
                        </TableCell>
                        <TableCell>
                          <div>
                            {formatDate(tax.due_date)}
                            {days <= 14 && days >= 0 && (
                              <Badge variant="warning" className="ml-2">
                                {days === 0 ? "Today" : `${days}d`}
                              </Badge>
                            )}
                            {days < 0 && (
                              <Badge variant="destructive" className="ml-2">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(tax.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tax.status === "pending"
                                ? "secondary"
                                : tax.status === "confirmed"
                                ? "success"
                                : "default"
                            }
                          >
                            {PAYMENT_STATUS_LABELS[tax.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Confirmed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmedBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">
                        {bill.description || bill.bill_type}
                      </TableCell>
                      <TableCell>{bill.property?.name || "-"}</TableCell>
                      <TableCell>
                        {bill.payment_date ? formatDate(bill.payment_date) : "-"}
                      </TableCell>
                      <TableCell>{formatCurrency(bill.amount)}</TableCell>
                      <TableCell>
                        {bill.confirmation_date ? (
                          <Badge variant="success">
                            {formatDate(bill.confirmation_date)}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {confirmedBills.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-8"
                      >
                        No payment history yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
