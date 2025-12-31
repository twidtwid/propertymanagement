import Link from "next/link"
import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  DollarSign,
  Building2,
  Shield,
  Wrench,
  Receipt,
} from "lucide-react"
import { getYearEndExportData } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ReportCard, YearFilter, ExportButton } from "@/components/reports"

interface PageProps {
  searchParams: Promise<{ year?: string }>
}

export default async function YearEndExportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const year = params.year ? parseInt(params.year) : new Date().getFullYear()
  const report = await getYearEndExportData(year)

  // Prepare export data - flatten all categories
  const exportData = report.categories.flatMap((category) =>
    category.items.map((item) => ({
      category: category.category,
      description: item.description,
      amount: item.amount,
      date: item.date || "",
    }))
  )

  // Add summary row
  exportData.push({
    category: "TOTAL",
    description: "Grand Total",
    amount: report.grandTotal,
    date: "",
  })

  const categoryIcons: Record<string, React.ReactNode> = {
    "Property Taxes": <Building2 className="h-5 w-5" />,
    "Insurance Premiums": <Shield className="h-5 w-5" />,
    Maintenance: <Wrench className="h-5 w-5" />,
    "Other Bills": <Receipt className="h-5 w-5" />,
  }

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
            <h1 className="text-3xl font-semibold tracking-tight">Year-End Export</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Complete financial summary for {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <YearFilter currentYear={year} />
          </Suspense>
          <ExportButton
            data={exportData}
            filename={`year-end-${year}`}
            label="Export Full Report"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <ReportCard
          title="Grand Total"
          value={formatCurrency(report.grandTotal)}
          subtitle={`${year} expenses`}
          icon={<DollarSign className="h-5 w-5" />}
          className="md:col-span-1 bg-primary/5 border-primary/20"
        />
        <ReportCard
          title="Property Taxes"
          value={formatCurrency(report.propertyTaxTotal)}
          icon={<Building2 className="h-5 w-5" />}
        />
        <ReportCard
          title="Insurance"
          value={formatCurrency(report.insuranceTotal)}
          icon={<Shield className="h-5 w-5" />}
        />
        <ReportCard
          title="Maintenance"
          value={formatCurrency(report.maintenanceTotal)}
          icon={<Wrench className="h-5 w-5" />}
        />
        <ReportCard
          title="Other Bills"
          value={formatCurrency(report.otherBillsTotal)}
          icon={<Receipt className="h-5 w-5" />}
        />
      </div>

      {report.categories.map((category) => (
        <Card key={category.category}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  {categoryIcons[category.category] || <DollarSign className="h-5 w-5" />}
                </div>
                <CardTitle>{category.category}</CardTitle>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(category.total)}</p>
            </div>
          </CardHeader>
          <CardContent>
            {category.items.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No items in this category for {year}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {category.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>
                        {item.date ? formatDate(item.date) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={2}>Subtotal</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(category.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-3 text-primary-foreground">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-medium">Total Expenses for {year}</p>
                <p className="text-sm text-muted-foreground">
                  Across {report.categories.length} categories
                </p>
              </div>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(report.grandTotal)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
