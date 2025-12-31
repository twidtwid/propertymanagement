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
import { ArrowLeft, Calendar, DollarSign, CheckCircle, Clock } from "lucide-react"
import { getTaxCalendarReport } from "@/lib/actions"
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils"
import { PAYMENT_STATUS_LABELS } from "@/types/database"
import {
  ReportBarChart,
  ReportCard,
  YearFilter,
  ExportButton,
} from "@/components/reports"

interface PageProps {
  searchParams: Promise<{ year?: string }>
}

export default async function TaxCalendarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const year = params.year ? parseInt(params.year) : new Date().getFullYear()
  const report = await getTaxCalendarReport(year)

  // Transform data for chart - by jurisdiction
  const byJurisdictionData = Object.entries(report.byJurisdiction)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Group taxes by month for timeline view
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const byMonthData = monthOrder
    .filter((month) => report.byMonth[month])
    .map((month) => ({ name: month, value: report.byMonth[month] || 0 }))

  // Prepare export data
  const exportData = report.taxes.map((tax) => ({
    property: (tax as { property?: { name: string } }).property?.name || "Unknown",
    jurisdiction: tax.jurisdiction,
    year: tax.tax_year,
    installment: `Q${tax.installment}`,
    due_date: tax.due_date,
    amount: tax.amount,
    status: PAYMENT_STATUS_LABELS[tax.status] || tax.status,
    payment_date: tax.payment_date || "",
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
            <h1 className="text-3xl font-semibold tracking-tight">Tax Calendar</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Property tax schedule for {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <YearFilter currentYear={year} />
          </Suspense>
          <ExportButton data={exportData} filename={`tax-calendar-${year}`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard
          title="Total Tax Due"
          value={formatCurrency(report.totalDue)}
          subtitle={`${report.taxes.length} payments`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <ReportCard
          title="Paid"
          value={formatCurrency(report.totalPaid)}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <ReportCard
          title="Pending"
          value={formatCurrency(report.totalPending)}
          icon={<Clock className="h-5 w-5" />}
        />
        <ReportCard
          title="Jurisdictions"
          value={Object.keys(report.byJurisdiction).length.toString()}
          icon={<Calendar className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Taxes by Jurisdiction</CardTitle>
          </CardHeader>
          <CardContent>
            {byJurisdictionData.length > 0 ? (
              <ReportBarChart data={byJurisdictionData} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No tax data for {year}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxes by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {byMonthData.length > 0 ? (
              <ReportBarChart data={byMonthData} color="#f59e0b" />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No tax data for {year}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax Payment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Quarter</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.taxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No tax payments for {year}
                  </TableCell>
                </TableRow>
              ) : (
                report.taxes.map((tax) => {
                  const days = daysUntil(tax.due_date)
                  return (
                    <TableRow key={tax.id}>
                      <TableCell className="font-medium">
                        {(tax as { property?: { name: string } }).property?.name || "-"}
                      </TableCell>
                      <TableCell>{tax.jurisdiction}</TableCell>
                      <TableCell>Q{tax.installment}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(tax.due_date)}
                          {tax.status !== "confirmed" && days <= 30 && days >= 0 && (
                            <Badge variant="warning">{days}d</Badge>
                          )}
                          {tax.status !== "confirmed" && days < 0 && (
                            <Badge variant="destructive">Overdue</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(tax.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tax.status === "confirmed"
                              ? "success"
                              : tax.status === "sent"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {PAYMENT_STATUS_LABELS[tax.status] || tax.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
