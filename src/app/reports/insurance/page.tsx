export const dynamic = 'force-dynamic'

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
import { ArrowLeft, Shield, DollarSign, AlertTriangle, FileText } from "lucide-react"
import { getInsuranceCoverageReport } from "@/lib/actions"
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils"
import {
  ReportBarChart,
  ReportPieChart,
  ReportCard,
  ExportButton,
} from "@/components/reports"

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  homeowners: "Homeowners",
  auto: "Auto",
  umbrella: "Umbrella",
  flood: "Flood",
  earthquake: "Earthquake",
  liability: "Liability",
  health: "Health",
  travel: "Travel",
  other: "Other",
}

export default async function InsuranceCoveragePage() {
  const report = await getInsuranceCoverageReport()

  // Transform data for charts
  const byTypePremiumData = Object.entries(report.byType)
    .map(([type, data]) => ({
      name: INSURANCE_TYPE_LABELS[type] || type,
      value: data.premium,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const byTypeCoverageData = Object.entries(report.byType)
    .map(([type, data]) => ({
      name: INSURANCE_TYPE_LABELS[type] || type,
      value: data.coverage,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  // Prepare export data
  const exportData = report.policies.map((policy) => ({
    carrier: policy.carrier_name,
    policy_number: policy.policy_number || "",
    type: INSURANCE_TYPE_LABELS[policy.policy_type] || policy.policy_type,
    property:
      (policy as { property?: { name: string } }).property?.name ||
      ((policy as { vehicle?: { year: number; make: string; model: string } }).vehicle
        ? `${(policy as { vehicle?: { year: number; make: string; model: string } }).vehicle?.year} ${(policy as { vehicle?: { year: number; make: string; model: string } }).vehicle?.make} ${(policy as { vehicle?: { year: number; make: string; model: string } }).vehicle?.model}`
        : "General"),
    premium: policy.premium_amount || "",
    frequency: policy.premium_frequency || "",
    coverage: policy.coverage_amount || "",
    deductible: policy.deductible || "",
    expiration: policy.expiration_date || "",
    auto_renew: policy.auto_renew ? "Yes" : "No",
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
            <h1 className="text-3xl font-semibold tracking-tight">Insurance Coverage</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Policy summary and premium analysis
            </p>
          </div>
        </div>
        <ExportButton data={exportData} filename="insurance-coverage" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard
          title="Annual Premiums"
          value={formatCurrency(report.totalAnnualPremium)}
          subtitle={`${report.policyCount} policies`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Coverage"
          value={formatCurrency(report.totalCoverage)}
          icon={<Shield className="h-5 w-5" />}
        />
        <ReportCard
          title="Policy Types"
          value={Object.keys(report.byType).length.toString()}
          icon={<FileText className="h-5 w-5" />}
        />
        <ReportCard
          title="Expiring Soon"
          value={report.expiringWithin60Days.toString()}
          subtitle="within 60 days"
          icon={<AlertTriangle className="h-5 w-5" />}
          className={report.expiringWithin60Days > 0 ? "border-amber-200 bg-amber-50/50" : ""}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Annual Premiums by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {byTypePremiumData.length > 0 ? (
              <ReportBarChart data={byTypePremiumData} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No insurance data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {byTypeCoverageData.length > 0 ? (
              <ReportPieChart data={byTypeCoverageData} height={350} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No insurance data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Covers</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No insurance policies found
                  </TableCell>
                </TableRow>
              ) : (
                report.policies.map((policy) => {
                  const days = policy.expiration_date ? daysUntil(policy.expiration_date) : null
                  const vehicle = policy as { vehicle?: { year: number; make: string; model: string } }
                  const property = policy as { property?: { name: string } }

                  return (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{policy.carrier_name}</p>
                          {policy.policy_number && (
                            <p className="text-sm text-muted-foreground font-mono">
                              {policy.policy_number}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {INSURANCE_TYPE_LABELS[policy.policy_type] || policy.policy_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {property.property?.name ||
                          (vehicle.vehicle
                            ? `${vehicle.vehicle.year} ${vehicle.vehicle.make} ${vehicle.vehicle.model}`
                            : "General")}
                      </TableCell>
                      <TableCell>
                        {policy.premium_amount ? (
                          <div>
                            <p className="font-medium">
                              {formatCurrency(Number(policy.premium_amount))}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              /{policy.premium_frequency}
                            </p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {policy.coverage_amount
                          ? formatCurrency(Number(policy.coverage_amount))
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {policy.expiration_date ? formatDate(policy.expiration_date) : "-"}
                      </TableCell>
                      <TableCell>
                        {days !== null ? (
                          days <= 0 ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : days <= 60 ? (
                            <Badge variant="warning">{days}d left</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
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
