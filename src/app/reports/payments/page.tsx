import Link from "next/link"
import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, DollarSign, FileText, TrendingUp, Receipt } from "lucide-react"
import { getPaymentSummaryReport } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { BILL_TYPE_LABELS, PAYMENT_STATUS_LABELS, type BillType } from "@/types/database"
import {
  ReportBarChart,
  ReportPieChart,
  ReportCard,
  YearFilter,
  ExportButton,
} from "@/components/reports"

interface PageProps {
  searchParams: Promise<{ year?: string }>
}

export default async function PaymentSummaryPage({ searchParams }: PageProps) {
  const params = await searchParams
  const year = params.year ? parseInt(params.year) : new Date().getFullYear()
  const report = await getPaymentSummaryReport(year)

  // Transform data for charts
  const byTypeData = Object.entries(report.byType).map(([name, value]) => ({
    name: BILL_TYPE_LABELS[name as BillType] || name,
    value,
  }))

  const byPropertyData = Object.entries(report.byProperty)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Prepare export data
  const exportData = report.bills.map((bill) => ({
    date: bill.due_date,
    type: BILL_TYPE_LABELS[bill.bill_type as BillType] || bill.bill_type,
    description: bill.description || "",
    property: (bill as { property?: { name: string } }).property?.name || "N/A",
    amount: bill.amount,
    status: PAYMENT_STATUS_LABELS[bill.status] || bill.status,
    payment_date: bill.payment_date || "",
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/reports">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Payment Summary</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Overview of all payments for {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <YearFilter currentYear={year} />
          </Suspense>
          <ExportButton data={exportData} filename={`payments-${year}`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard
          title="Total Payments"
          value={formatCurrency(report.total)}
          subtitle={`${report.count} bills`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <ReportCard
          title="Average Per Bill"
          value={formatCurrency(report.count > 0 ? report.total / report.count : 0)}
          icon={<Receipt className="h-5 w-5" />}
        />
        <ReportCard
          title="Monthly Average"
          value={formatCurrency(report.total / 12)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <ReportCard
          title="Bill Types"
          value={Object.keys(report.byType).length.toString()}
          subtitle="categories"
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {byTypeData.length > 0 ? (
              <ReportBarChart data={byTypeData} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No payment data for {year}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Property</CardTitle>
          </CardHeader>
          <CardContent>
            {byPropertyData.length > 0 ? (
              <ReportPieChart data={byPropertyData} height={350} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No payment data for {year}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No payments for {year}
                  </TableCell>
                </TableRow>
              ) : (
                report.bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>{formatDate(bill.due_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {BILL_TYPE_LABELS[bill.bill_type as BillType] || bill.bill_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{bill.description || "-"}</TableCell>
                    <TableCell>
                      {(bill as { property?: { name: string } }).property?.name || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(Number(bill.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          bill.status === "confirmed"
                            ? "success"
                            : bill.status === "sent"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {PAYMENT_STATUS_LABELS[bill.status] || bill.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
