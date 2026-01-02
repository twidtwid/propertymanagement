export const dynamic = 'force-dynamic'

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Wrench,
  ClipboardList,
  History,
} from "lucide-react"
import { getMaintenanceTasks, getPendingMaintenanceTasks, getSharedTaskLists, getActiveProperties, getActiveVehicles, getActiveVendors } from "@/lib/actions"
import { formatDate } from "@/lib/utils"
import { AddTaskButton } from "@/components/maintenance/add-task-button"
import { MaintenanceTaskList } from "@/components/maintenance/maintenance-task-list"

export default async function MaintenancePage() {
  const [allTasks, pendingTasks, taskLists, properties, vehicles, vendors] = await Promise.all([
    getMaintenanceTasks(),
    getPendingMaintenanceTasks(),
    getSharedTaskLists(),
    getActiveProperties(),
    getActiveVehicles(),
    getActiveVendors(),
  ])

  const completedTasks = allTasks.filter((t) => t.status === "completed")

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Maintenance</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track maintenance tasks and shared task lists
          </p>
        </div>
        <AddTaskButton properties={properties} vehicles={vehicles} vendors={vendors} />
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Wrench className="h-4 w-4" />
            Pending ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="lists" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Task Lists ({taskLists.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <MaintenanceTaskList
            tasks={pendingTasks}
            properties={properties}
            vehicles={vehicles}
            vendors={vendors}
          />
        </TabsContent>

        <TabsContent value="lists">
          <div className="grid gap-4 md:grid-cols-2">
            {taskLists.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="py-8">
                  <p className="text-muted-foreground text-center">
                    No shared task lists
                  </p>
                </CardContent>
              </Card>
            ) : (
              taskLists.map((list) => (
                <Card key={list.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{list.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {list.property?.name}
                        </p>
                      </div>
                      <Badge
                        variant={list.is_active ? "success" : "secondary"}
                      >
                        {list.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {list.assigned_to && (
                      <p className="text-base mb-4">
                        <span className="text-muted-foreground">
                          Assigned to:
                        </span>{" "}
                        {list.assigned_to}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/maintenance/lists/${list.id}`}>
                          View List
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm">
                        Share
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Completed Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {completedTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No completed tasks
                </p>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 rounded-xl border"
                    >
                      <div>
                        <p className="text-base font-medium line-through text-muted-foreground">
                          {task.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {task.property?.name ||
                            (task.vehicle
                              ? `${task.vehicle.year} ${task.vehicle.make}`
                              : "")}
                        </p>
                      </div>
                      <div className="text-right">
                        {task.completed_date && (
                          <p className="text-sm text-muted-foreground">
                            Completed {formatDate(task.completed_date)}
                          </p>
                        )}
                        {task.actual_cost && (
                          <p className="text-sm font-medium">
                            ${task.actual_cost.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
