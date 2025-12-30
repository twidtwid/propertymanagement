import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  Download,
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
} from "lucide-react"

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Generate reports and analytics for your properties
          </p>
        </div>
        <Button size="lg" variant="outline">
          <Download className="h-5 w-5 mr-2" />
          Export All
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-50 p-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Payment Summary</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Overview of all payments by property and type
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-green-50 p-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Property Values</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Track property values and appreciation over time
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-amber-50 p-3">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Tax Calendar</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Annual property tax schedule across all jurisdictions
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-purple-50 p-3">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Maintenance Costs</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Breakdown of maintenance expenses by property
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-red-50 p-3">
                <BarChart3 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Insurance Coverage</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Summary of all insurance policies and coverage amounts
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-cyan-50 p-3">
                <Download className="h-6 w-6 text-cyan-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Year-End Export</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete export for tax preparation and accounting
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Generate Report
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Full reporting and analytics features are in development. Reports will include:
          </p>
          <ul className="list-disc list-inside mt-4 text-muted-foreground space-y-2">
            <li>Interactive charts and graphs</li>
            <li>Customizable date ranges</li>
            <li>Export to PDF and Excel</li>
            <li>Scheduled report delivery via email</li>
            <li>Comparison reports across properties</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
