import Link from "next/link"
import { redirect } from "next/navigation"
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
  CheckCircle2,
  Building2,
  Package,
  Star,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react"
import { generateDailySummary } from "@/lib/daily-summary"
import { sendDailySummaryEmail } from "@/lib/notifications"
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils"
import { ReportCard } from "@/components/reports"

async function sendEmailAction() {
  "use server"
  await sendDailySummaryEmail()
  redirect("/reports/daily-summary?sent=true")
}

export const dynamic = "force-dynamic"

export default async function DailySummaryPage() {
  const summary = await generateDailySummary()

  const hasAttentionItems = summary.overdueItems.length > 0 || summary.urgentItems.length > 0
  const totalAttention = summary.overdueItems.length + summary.urgentItems.length

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
        <form action={sendEmailAction}>
          <Button type="submit" variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Send Email Now
          </Button>
        </form>
      </div>

      {/* Status Banner */}
      {hasAttentionItems ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-red-900">
                  {totalAttention} item{totalAttention !== 1 ? 's' : ''} need attention
                </h2>
                <p className="text-sm text-red-700">
                  {summary.overdueItems.length > 0 && `${summary.overdueItems.length} overdue`}
                  {summary.overdueItems.length > 0 && summary.urgentItems.length > 0 && ' • '}
                  {summary.urgentItems.length > 0 && `${summary.urgentItems.length} due this week`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <h2 className="text-lg font-semibold text-green-900">All Clear</h2>
                <p className="text-sm text-green-700">
                  {summary.upcomingItems[0]
                    ? `Next: ${summary.upcomingItems[0].title} due ${summary.upcomingItems[0].daysUntil === 0 ? 'today' : summary.upcomingItems[0].daysUntil === 1 ? 'tomorrow' : `in ${summary.upcomingItems[0].daysUntil} days`}`
                    : 'No upcoming payments in the next 30 days.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <ReportCard
          title="Overdue"
          value={summary.overdueItems.length.toString()}
          subtitle="Past due date"
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
        />
        <ReportCard
          title="Due Soon"
          value={summary.urgentItems.length.toString()}
          subtitle="This week"
          icon={<Clock className="h-5 w-5 text-orange-500" />}
        />
        <ReportCard
          title="Coming Up"
          value={summary.upcomingItems.length.toString()}
          subtitle="Next 30 days"
          icon={<Calendar className="h-5 w-5 text-blue-500" />}
        />
        <ReportCard
          title="Pinned Notes"
          value={summary.pinnedNotes.length.toString()}
          subtitle="With due dates"
          icon={<FileText className="h-5 w-5 text-yellow-500" />}
        />
        <ReportCard
          title="BuildingLink"
          value={summary.stats.buildingLinkAttentionCount.toString()}
          subtitle="Need attention"
          icon={<Building2 className="h-5 w-5 text-amber-500" />}
        />
      </div>

      {/* OVERDUE Section */}
      {summary.overdueItems.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Overdue
              <Badge variant="destructive" className="ml-auto">
                {summary.overdueItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.overdueItems.map((item) => {
              const daysOverdue = item.daysUntilOrOverdue ? Math.abs(item.daysUntilOrOverdue) : 0
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block p-4 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-sm text-red-600 font-medium mt-1">
                        {item.subtitle && <span>{item.subtitle} — </span>}
                        {daysOverdue} days overdue
                      </div>
                    </div>
                    {item.amount && (
                      <span className="text-lg font-bold text-red-700">
                        {formatCurrency(item.amount)}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* DUE THIS WEEK Section */}
      {summary.urgentItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Clock className="h-5 w-5" />
              Due This Week
              <Badge className="ml-auto bg-orange-500">
                {summary.urgentItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.urgentItems.map((item) => {
              const daysDesc = item.daysUntilOrOverdue === 0 ? 'Due today' :
                item.daysUntilOrOverdue === 1 ? 'Due tomorrow' :
                item.daysUntilOrOverdue !== null ? `Due in ${item.daysUntilOrOverdue} days` : ''
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block p-4 bg-white rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-sm text-orange-600 mt-1">
                        {item.subtitle && <span>{item.subtitle} — </span>}
                        {daysDesc}
                      </div>
                    </div>
                    {item.amount && (
                      <span className="text-lg font-bold text-orange-700">
                        {formatCurrency(item.amount)}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* PINNED NOTES Section */}
      {summary.pinnedNotes.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <FileText className="h-5 w-5" />
              Your Pinned Notes
              <Badge className="ml-auto bg-yellow-500 text-yellow-900">
                {summary.pinnedNotes.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.pinnedNotes.map((note) => (
              <Link
                key={note.id}
                href={note.href}
                className="block p-4 bg-white rounded-lg border border-yellow-200 hover:bg-yellow-50 transition-colors"
              >
                <div className="font-semibold">&ldquo;{note.content}&rdquo;</div>
                <div className="text-sm text-muted-foreground mt-2">
                  → {note.entityTitle}
                  {note.dueDate && <span className="ml-2">• Due: {formatDate(note.dueDate)}</span>}
                  {note.createdBy && <span className="ml-2">• Added by {note.createdBy}</span>}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* COMING UP Section */}
      {summary.upcomingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Coming Up (Next 7 Days)
              <Badge variant="secondary" className="ml-auto">
                {summary.upcomingItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.upcomingItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors"
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
                      {item.subtitle && <span>{item.subtitle} — </span>}
                      {item.amount && formatCurrency(item.amount)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BUILDINGLINK Section */}
      {summary.buildingLinkItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <Building2 className="h-5 w-5" />
              BuildingLink
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
                          Active Outages ({outages.length})
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
                              {item.unit !== 'unknown' && `Unit ${item.unit} • `}{formatDateTime(item.receivedAt)}
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
                              {item.unit !== 'unknown' && `Unit ${item.unit} • `}{formatDateTime(item.receivedAt)}
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
                          Flagged Items ({flagged.length})
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
                              {item.unit !== 'unknown' && `Unit ${item.unit} • `}{formatDateTime(item.receivedAt)}
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

      {/* VENDOR EMAILS Section */}
      {summary.recentEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Vendor Emails Today
              <Badge variant="secondary" className="ml-auto">
                {summary.recentEmails.length}
              </Badge>
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

      {/* TASK SUMMARY */}
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

      {/* ALL CLEAR State */}
      {summary.overdueItems.length === 0 &&
        summary.urgentItems.length === 0 &&
        summary.upcomingItems.length === 0 &&
        summary.recentEmails.length === 0 &&
        summary.buildingLinkItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">Everything is in order!</h3>
              <p className="text-muted-foreground mt-1">
                No urgent items, upcoming tasks, or messages requiring attention.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
