import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"
import { getPropertyTaxes, getActiveProperties } from "@/lib/actions"
import { TaxTable } from "@/components/payments/tax-table"
import { AddTaxButton } from "@/components/payments/add-tax-button"

export default async function TaxesPage() {
  const [taxes, properties] = await Promise.all([
    getPropertyTaxes(),
    getActiveProperties(),
  ])

  // Calculate stats
  const pendingTaxes = taxes.filter(t => t.status === "pending")
  const overdueTaxes = pendingTaxes.filter(t => new Date(t.due_date) < new Date())
  const sentTaxes = taxes.filter(t => t.status === "sent")
  const totalPending = pendingTaxes.reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Property Taxes</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track and manage property tax payments across all jurisdictions
          </p>
        </div>
        <AddTaxButton properties={properties} />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingTaxes.length} payment{pendingTaxes.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className={overdueTaxes.length > 0 ? "border-red-200 bg-red-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            {overdueTaxes.length > 0 && <Badge variant="destructive">{overdueTaxes.length}</Badge>}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueTaxes.length > 0 ? "text-red-600" : ""}`}>
              {overdueTaxes.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Need immediate attention
            </p>
          </CardContent>
        </Card>

        <Card className={sentTaxes.length > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Confirmation</CardTitle>
            {sentTaxes.length > 0 && <Badge variant="warning">{sentTaxes.length}</Badge>}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${sentTaxes.length > 0 ? "text-amber-600" : ""}`}>
              {sentTaxes.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Payments sent, not confirmed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taxes.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all properties
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tax Table */}
      <Card>
        <CardContent className="pt-6">
          <TaxTable
            taxes={taxes.map(t => ({
              ...t,
              property_name: (t.property as any)?.name,
            }))}
            properties={properties}
          />
        </CardContent>
      </Card>
    </div>
  )
}
