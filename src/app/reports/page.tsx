import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
  Download,
  Shield,
  Wrench,
  ArrowRight,
  Sun,
  Users,
  Ticket,
  CalendarDays,
} from "lucide-react"

const reports = [
  {
    title: "Daily Summary",
    description: "Today's urgent items, upcoming tasks, and recent emails",
    href: "/reports/daily-summary",
    icon: Sun,
    color: "orange",
  },
  {
    title: "Vendor Directory",
    description: "All vendors by region, property, or specialty with activity",
    href: "/reports/vendors",
    icon: Users,
    color: "indigo",
  },
  {
    title: "Ticket Report",
    description: "All tickets sorted by house, vendor, or date",
    href: "/reports/tickets",
    icon: Ticket,
    color: "rose",
  },
  {
    title: "Weekly Tickets",
    description: "Weekly breakdown of tickets by vendor and property",
    href: "/reports/tickets/weekly",
    icon: CalendarDays,
    color: "teal",
  },
  {
    title: "Payment Summary",
    description: "Overview of all payments by property and type",
    href: "/reports/payments",
    icon: DollarSign,
    color: "blue",
  },
  {
    title: "Property Values",
    description: "Track property values and appreciation over time",
    href: "/reports/property-values",
    icon: TrendingUp,
    color: "green",
  },
  {
    title: "Tax Calendar",
    description: "Annual property tax schedule across all jurisdictions",
    href: "/reports/tax-calendar",
    icon: Calendar,
    color: "amber",
  },
  {
    title: "Maintenance Costs",
    description: "Breakdown of maintenance expenses by property",
    href: "/reports/maintenance",
    icon: Wrench,
    color: "purple",
  },
  {
    title: "Insurance Coverage",
    description: "Summary of all insurance policies and coverage amounts",
    href: "/reports/insurance",
    icon: Shield,
    color: "red",
  },
  {
    title: "Year-End Export",
    description: "Complete export for tax preparation and accounting",
    href: "/reports/year-end",
    icon: Download,
    color: "cyan",
  },
]

const colorClasses: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  green: { bg: "bg-green-50", text: "text-green-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
  red: { bg: "bg-red-50", text: "text-red-600" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-600" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  rose: { bg: "bg-rose-50", text: "text-rose-600" },
  teal: { bg: "bg-teal-50", text: "text-teal-600" },
}

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
        <Button size="lg" variant="outline" asChild>
          <Link href="/reports/year-end">
            <Download className="h-5 w-5 mr-2" />
            Year-End Export
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon
          const colors = colorClasses[report.color]

          return (
            <Link key={report.href} href={report.href}>
              <Card className="h-full cursor-pointer hover:shadow-md transition-shadow group">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-xl ${colors.bg} p-3`}>
                      <Icon className={`h-6 w-6 ${colors.text}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {report.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {report.description}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Report Features</h3>
              <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                <li>Interactive charts and graphs</li>
                <li>Year selector for historical data</li>
                <li>Export to CSV for accounting software</li>
                <li>Real-time data from your properties</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
