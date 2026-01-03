import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  Mail,
  DollarSign,
  ClipboardList,
  RefreshCw,
  Building2,
  Package,
  Star,
} from "lucide-react"
import { generateDailySummary } from "@/lib/daily-summary"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { ReportCard } from "@/components/reports"

export const dynamic = "force-dynamic"

export default async function DailySummaryPage() {
  const summary = await generateDailySummary()

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
            <h1 className="text-3xl font-semibold tracking-tight">Daily Summary</h1>
            <p className="text-lg text-muted-foreground mt-1">
              {summary.date}
            </p>
          </div>
        </div>
        <form action="/api/cron/daily-summary" method="POST">
          <Button type="submit" variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Send Email Now
          </Button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <ReportCard
          title="Urgent Items"
          value={summary.urgentItems.length.toString()}
          subtitle="Require attention"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <ReportCard
          title="Upcoming"
          value={summary.upcomingItems.length.toString()}
          subtitle="Next 7-30 days"
          icon={<Calendar className="h-5 w-5" />}
        />
        <ReportCard
          title="Bills Due"
          value={formatCurrency(summary.stats.totalBillsAmount)}
          subtitle={`${summary.stats.totalBillsDue} this week`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <ReportCard
          title="Emails Today"
          value={summary.stats.newEmailsToday.toString()}
          subtitle="New vendor emails"
          icon={<Mail className="h-5 w-5" />}
        />
        <ReportCard
          title="BuildingLink"
          value={summary.stats.buildingLinkAttentionCount.toString()}
          subtitle="Items need attention"
          icon={<Building2 className="h-5 w-5" />}
        />
      </div>

      {summary.buildingLinkItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <Building2 className="h-5 w-5" />
              Needs Attention
              <Badge variant="secondary" className="ml-auto bg-amber-200 text-amber-800">
                {summary.buildingLinkItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {(() => {
              const outages = summary.buildingLinkItems.filter(i => i.type === 'outage')
              const packages = summary.buildingLinkItems.filter(i => i.type === 'package')
              const flagged = summary.buildingLinkItems.filter(i => i.type === 'flagged')

              return (
                <>
                  {outages.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-700 uppercase tracking-wide">
                          Active Outages
                        </span>
                      </div>
                      <div className="space-y-2">
                        {outages.map((item, index) => (
                          <div
                            key={index}
                            className="p-3 bg-white rounded-lg border border-red-200"
                          >
                            <div className="font-medium">{item.subject}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Unit {item.unit} • {formatDateTime(item.receivedAt)}
                            </div>
                            {item.snippet && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {item.snippet}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {packages.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
                          Uncollected Packages ({packages.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {packages.map((item, index) => (
                          <div
                            key={index}
                            className="p-3 bg-white rounded-lg border border-purple-200"
                          >
                            <div className="font-medium">{item.subject}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Unit {item.unit} • {formatDateTime(item.receivedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {flagged.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-yellow-600 fill-yellow-400" />
                        <span className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">
                          Flagged Items
                        </span>
                      </div>
                      <div className="space-y-2">
                        {flagged.map((item, index) => (
                          <div
                            key={index}
                            className="p-3 bg-white rounded-lg border border-yellow-200"
                          >
                            <div className="font-medium">{item.subject}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Unit {item.unit} • {formatDateTime(item.receivedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
            <Button variant="outline" asChild className="w-full">
              <Link href="/buildinglink">View All BuildingLink Messages</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {summary.upcomingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Coming Up (Next 7-30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.upcomingItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {item.daysUntil === 0
                          ? "Today"
                          : item.daysUntil === 1
                          ? "Tomorrow"
                          : `${item.daysUntil} days`}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  </div>
                  {item.link && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={item.link}>View</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.recentEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Recent Vendor Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.recentEmails.map((email, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {email.vendorName || "Unknown"}
                      </span>
                      {email.isUrgent && (
                        <Badge variant="destructive" className="text-xs">
                          URGENT
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {email.subject}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(email.receivedAt)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.stats.urgentTasksCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Task Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You have <span className="font-semibold text-foreground">{summary.stats.urgentTasksCount}</span> urgent or high-priority maintenance tasks pending.
            </p>
            <Button className="mt-4" variant="outline" asChild>
              <Link href="/maintenance">View Tasks</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {summary.urgentItems.length === 0 &&
        summary.upcomingItems.length === 0 &&
        summary.recentEmails.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">All Clear!</h3>
              <p className="text-muted-foreground mt-1">
                No urgent items or upcoming tasks right now.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
