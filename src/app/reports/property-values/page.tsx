import Link from "next/link"
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
import { ArrowLeft, Building2, TrendingUp, DollarSign, Percent } from "lucide-react"
import { getPropertyValuesReport } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PROPERTY_TYPE_LABELS, type PropertyType } from "@/types/database"
import { ReportBarChart, ReportCard, ExportButton } from "@/components/reports"

export default async function PropertyValuesPage() {
  const report = await getPropertyValuesReport()

  // Transform data for chart - compare purchase vs current value
  const chartData = report.properties
    .filter((p) => p.purchase_price || p.current_value)
    .map((p) => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name,
      value: p.current_value || 0,
    }))
    .sort((a, b) => b.value - a.value)

  // Prepare export data
  const exportData = report.properties.map((p) => ({
    name: p.name,
    city: p.city,
    state: p.state || "",
    type: PROPERTY_TYPE_LABELS[p.property_type as PropertyType] || p.property_type,
    purchase_date: p.purchase_date || "",
    purchase_price: p.purchase_price || "",
    current_value: p.current_value || "",
    appreciation: p.appreciation || "",
    appreciation_percent: p.appreciationPercent ? `${p.appreciationPercent.toFixed(1)}%` : "",
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
            <h1 className="text-3xl font-semibold tracking-tight">Property Values</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Portfolio valuation and appreciation tracking
            </p>
          </div>
        </div>
        <ExportButton data={exportData} filename="property-values" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard
          title="Total Portfolio Value"
          value={formatCurrency(report.totalCurrentValue)}
          subtitle={`${report.properties.length} properties`}
          icon={<Building2 className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Purchase Price"
          value={formatCurrency(report.totalPurchaseValue)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Appreciation"
          value={formatCurrency(report.totalAppreciation)}
          trend={
            report.totalPurchaseValue > 0
              ? {
                  value: (report.totalAppreciation / report.totalPurchaseValue) * 100,
                  label: "overall",
                }
              : undefined
          }
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <ReportCard
          title="Avg Appreciation"
          value={`${report.averageAppreciationPercent.toFixed(1)}%`}
          subtitle="per property"
          icon={<Percent className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property Values Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ReportBarChart data={chartData} height={350} />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No property value data available
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead>Purchase Price</TableHead>
                <TableHead>Current Value</TableHead>
                <TableHead>Appreciation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No properties found
                  </TableCell>
                </TableRow>
              ) : (
                report.properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/properties/${property.id}`}
                        className="hover:underline"
                      >
                        {property.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {property.city}
                      {property.state ? `, ${property.state}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PROPERTY_TYPE_LABELS[property.property_type as PropertyType] || property.property_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {property.purchase_date ? formatDate(property.purchase_date) : "-"}
                    </TableCell>
                    <TableCell>
                      {property.purchase_price
                        ? formatCurrency(property.purchase_price)
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {property.current_value
                        ? formatCurrency(property.current_value)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {property.appreciationPercent !== null ? (
                        <Badge
                          variant={property.appreciationPercent >= 0 ? "success" : "destructive"}
                        >
                          {property.appreciationPercent >= 0 ? "+" : ""}
                          {property.appreciationPercent.toFixed(1)}%
                        </Badge>
                      ) : (
                        "-"
                      )}
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
