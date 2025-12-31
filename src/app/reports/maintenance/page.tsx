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
import { ArrowLeft, Wrench, DollarSign, CheckCircle, Clock } from "lucide-react"
import { getMaintenanceCostsReport } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_LABELS, type TaskPriority } from "@/types/database"
import {
  ReportBarChart,
  ReportPieChart,
  ReportCard,
  YearFilter,
  ExportButton,
} from "@/components/reports"

interface PageProps {
  searchParams: Promise<{ year?: string }>
}

export default async function MaintenanceCostsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const year = params.year ? parseInt(params.year) : new Date().getFullYear()
  const report = await getMaintenanceCostsReport(year)

  // Transform data for charts
  const byPropertyData = Object.entries(report.byProperty)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const byPriorityData = Object.entries(report.byPriority)
    .map(([name, value]) => ({
      name: TASK_PRIORITY_LABELS[name as TaskPriority] || name,
      value,
    }))
    .filter((d) => d.value > 0)

  // Prepare export data
  const exportData = report.tasks.map((task) => ({
    title: task.title,
    property: (task as { property?: { name: string } }).property?.name || "N/A",
    priority: TASK_PRIORITY_LABELS[task.priority] || task.priority,
    status: task.status,
    due_date: task.due_date || "",
    completed_date: task.completed_date || "",
    estimated_cost: task.estimated_cost || "",
    actual_cost: task.actual_cost || "",
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
            <h1 className="text-3xl font-semibold tracking-tight">Maintenance Costs</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Expense breakdown for {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <YearFilter currentYear={year} />
          </Suspense>
          <ExportButton data={exportData} filename={`maintenance-${year}`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ReportCard
          title="Total Actual Cost"
          value={formatCurrency(report.totalActual)}
          subtitle={`${report.completedCount} completed`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <ReportCard
          title="Total Estimated"
          value={formatCurrency(report.totalEstimated)}
          subtitle={`${report.tasks.length} tasks`}
          icon={<Wrench className="h-5 w-5" />}
        />
        <ReportCard
          title="Completed"
          value={report.completedCount.toString()}
          subtitle="tasks"
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <ReportCard
          title="Pending"
          value={report.pendingCount.toString()}
          subtitle="tasks"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Costs by Property</CardTitle>
          </CardHeader>
          <CardContent>
            {byPropertyData.length > 0 ? (
              <ReportBarChart data={byPropertyData} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No maintenance data for {year}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Costs by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            {byPriorityData.length > 0 ? (
              <ReportPieChart
                data={byPriorityData}
                colors={["#ef4444", "#f59e0b", "#3b82f6", "#6b7280"]}
              />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No maintenance data for {year}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Estimated</TableHead>
                <TableHead>Actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No maintenance tasks for {year}
                  </TableCell>
                </TableRow>
              ) : (
                report.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      {(task as { property?: { name: string } }).property?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          task.priority === "urgent"
                            ? "destructive"
                            : task.priority === "high"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {TASK_PRIORITY_LABELS[task.priority] || task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          task.status === "completed"
                            ? "success"
                            : task.status === "in_progress"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.completed_date
                        ? formatDate(task.completed_date)
                        : task.due_date
                        ? formatDate(task.due_date)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {task.estimated_cost
                        ? formatCurrency(Number(task.estimated_cost))
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {task.actual_cost
                        ? formatCurrency(Number(task.actual_cost))
                        : "-"}
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
