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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ArrowLeft,
  Calendar,
  Building2,
  Users,
  DollarSign,
  ChevronDown,
  Ticket,
  ExternalLink,
} from "lucide-react"
import { getWeeklyTicketReport } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_LABELS, TICKET_STATUS_LABELS, type TaskPriority, type TaskStatus } from "@/types/database"
import { ReportCard, ExportButton, PrintButton } from "@/components/reports"

interface PageProps {
  searchParams: Promise<{ weeks?: string }>
}

export default async function WeeklyTicketReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const weeksBack = params.weeks ? parseInt(params.weeks) : 4
  const weeklyReport = await getWeeklyTicketReport(weeksBack)

  // Calculate totals
  const totalTickets = weeklyReport.reduce((sum, w) => sum + w.totalCount, 0)
  const totalCost = weeklyReport.reduce((sum, w) => sum + w.totalCost, 0)
  const avgTicketsPerWeek = weeklyReport.length > 0 ? Math.round(totalTickets / weeklyReport.length) : 0

  // Flatten all tickets for export
  const exportData = weeklyReport.flatMap(week =>
    Object.values(week.byProperty).flatMap(p =>
      p.tickets.map(t => ({
        week_start: week.weekStart,
        week_end: week.weekEnd,
        title: t.title,
        property: t.property_name || 'No Property',
        vendor: t.vendor_company || t.vendor_name || 'No Vendor',
        status: TICKET_STATUS_LABELS[t.status] || t.status,
        priority: TASK_PRIORITY_LABELS[t.priority] || t.priority,
        actual_cost: t.actual_cost || '',
        completed_date: t.completed_date ? formatDate(t.completed_date) : '',
      }))
    )
  )

  const formatWeekRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startMonth} - ${endMonth}`
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'warning'
      case 'medium': return 'secondary'
      default: return 'outline'
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'warning'
      case 'cancelled': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-8">
      {/* Print Header - hidden on screen, shown in print */}
      <div className="hidden print:block print-header">
        <h1 className="text-2xl font-bold">Weekly Ticket Summary</h1>
        <p className="text-sm text-muted-foreground">
          Last {weeksBack} weeks | Generated: {new Date().toLocaleDateString()} | {totalTickets} tickets | {formatCurrency(totalCost)} total cost
        </p>
      </div>

      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/reports">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Weekly Ticket Summary</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Last {weeksBack} weeks of maintenance activity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[4, 8, 12].map(w => (
              <Button
                key={w}
                variant={weeksBack === w ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link href={`/reports/tickets/weekly?weeks=${w}`}>
                  {w}w
                </Link>
              </Button>
            ))}
          </div>
          <PrintButton />
          <ExportButton data={exportData} filename="weekly-tickets" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 no-print">
        <ReportCard
          title="Total Tickets"
          value={totalTickets.toString()}
          subtitle={`in ${weeksBack} weeks`}
          icon={<Ticket className="h-5 w-5" />}
        />
        <ReportCard
          title="Avg/Week"
          value={avgTicketsPerWeek.toString()}
          subtitle="tickets per week"
          icon={<Calendar className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Cost"
          value={formatCurrency(totalCost)}
          subtitle="all maintenance"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <ReportCard
          title="Weeks"
          value={weeklyReport.length.toString()}
          subtitle="with activity"
          icon={<Calendar className="h-5 w-5" />}
        />
      </div>

      {weeklyReport.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tickets found in the last {weeksBack} weeks
          </CardContent>
        </Card>
      ) : (
        weeklyReport.map(week => (
          <Card key={week.weekStart} className="print-break-avoid">
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Week of {formatWeekRange(week.weekStart, week.weekEnd)}
                      <Badge variant="secondary" className="ml-2">
                        {week.totalCount} ticket{week.totalCount !== 1 ? 's' : ''}
                      </Badge>
                      {week.totalCost > 0 && (
                        <Badge variant="outline" className="ml-1">
                          {formatCurrency(week.totalCost)}
                        </Badge>
                      )}
                    </CardTitle>
                    <ChevronDown className="h-5 w-5 text-muted-foreground no-print" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Tabs defaultValue="byProperty">
                    <TabsList className="mb-4 no-print">
                      <TabsTrigger value="byProperty" className="gap-1">
                        <Building2 className="h-4 w-4" />
                        By Property
                      </TabsTrigger>
                      <TabsTrigger value="byVendor" className="gap-1">
                        <Users className="h-4 w-4" />
                        By Vendor
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="byProperty">
                      <div className="space-y-4">
                        {Object.entries(week.byProperty)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([propertyName, data]) => (
                            <div key={propertyName} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {propertyName}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{data.count}</Badge>
                                  {data.cost > 0 && (
                                    <Badge variant="outline">{formatCurrency(data.cost)}</Badge>
                                  )}
                                </div>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Ticket</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.tickets.map(ticket => (
                                    <TableRow key={ticket.id}>
                                      <TableCell>
                                        <Link
                                          href={`/tickets/${ticket.id}`}
                                          className="hover:underline flex items-center gap-1"
                                        >
                                          {ticket.title}
                                          <ExternalLink className="h-3 w-3 no-print" />
                                        </Link>
                                      </TableCell>
                                      <TableCell>
                                        {ticket.vendor_company || ticket.vendor_name || '-'}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={getStatusColor(ticket.status)} className="text-xs">
                                          {TICKET_STATUS_LABELS[ticket.status]}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={getPriorityColor(ticket.priority)} className="text-xs">
                                          {TASK_PRIORITY_LABELS[ticket.priority]}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {ticket.actual_cost ? formatCurrency(Number(ticket.actual_cost)) : '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="byVendor">
                      <div className="space-y-4">
                        {Object.entries(week.byVendor)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([vendorName, data]) => (
                            <div key={vendorName} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  {vendorName}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{data.count}</Badge>
                                  {data.cost > 0 && (
                                    <Badge variant="outline">{formatCurrency(data.cost)}</Badge>
                                  )}
                                </div>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Ticket</TableHead>
                                    <TableHead>Property</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.tickets.map(ticket => (
                                    <TableRow key={ticket.id}>
                                      <TableCell>
                                        <Link
                                          href={`/tickets/${ticket.id}`}
                                          className="hover:underline flex items-center gap-1"
                                        >
                                          {ticket.title}
                                          <ExternalLink className="h-3 w-3 no-print" />
                                        </Link>
                                      </TableCell>
                                      <TableCell>
                                        {ticket.property_name || '-'}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={getStatusColor(ticket.status)} className="text-xs">
                                          {TICKET_STATUS_LABELS[ticket.status]}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={getPriorityColor(ticket.priority)} className="text-xs">
                                          {TASK_PRIORITY_LABELS[ticket.priority]}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {ticket.actual_cost ? formatCurrency(Number(ticket.actual_cost)) : '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))
      )}
    </div>
  )
}
