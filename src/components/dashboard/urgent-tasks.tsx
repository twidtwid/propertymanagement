import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { MaintenanceTask } from "@/types/database"
import { TASK_PRIORITY_LABELS } from "@/types/database"

interface UrgentTasksProps {
  tasks: MaintenanceTask[]
}

export function UrgentTasks({ tasks }: UrgentTasksProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Urgent Tasks
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/maintenance">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No urgent tasks
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium truncate">{task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {task.property?.name || task.vehicle?.make + " " + task.vehicle?.model}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {task.due_date && (
                    <p className="text-sm text-muted-foreground">
                      {formatDate(task.due_date)}
                    </p>
                  )}
                  <Badge
                    variant={task.priority === "urgent" ? "destructive" : "warning"}
                  >
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
