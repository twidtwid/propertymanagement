"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Building2, Car, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { completeMaintenanceTask, deleteMaintenanceTask } from "@/lib/mutations"
import { formatDate, daysUntil } from "@/lib/utils"
import { TASK_PRIORITY_LABELS } from "@/types/database"
import { TaskFormDialog } from "./task-form-dialog"
import type { MaintenanceTask, Property, Vehicle, Vendor } from "@/types/database"

interface MaintenanceTaskListProps {
  tasks: MaintenanceTask[]
  properties: Property[]
  vehicles: Vehicle[]
  vendors: Vendor[]
}

export function MaintenanceTaskList({
  tasks,
  properties,
  vehicles,
  vendors,
}: MaintenanceTaskListProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null)
  const [deletingTask, setDeletingTask] = useState<MaintenanceTask | null>(null)

  const handleComplete = async (task: MaintenanceTask) => {
    startTransition(async () => {
      const result = await completeMaintenanceTask(task.id)
      if (result.success) {
        toast({ title: "Task completed" })
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    })
  }

  const handleDelete = async () => {
    if (!deletingTask) return

    startTransition(async () => {
      const result = await deleteMaintenanceTask(deletingTask.id)
      if (result.success) {
        toast({ title: "Task deleted" })
        setDeletingTask(null)
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    })
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">
            No pending maintenance tasks
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {tasks.map((task) => {
          const days = task.due_date ? daysUntil(task.due_date) : null
          return (
            <Card
              key={task.id}
              className={
                task.priority === "urgent"
                  ? "border-red-200 bg-red-50/50"
                  : task.priority === "high"
                  ? "border-amber-200 bg-amber-50/50"
                  : ""
              }
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Checkbox
                    className="mt-1"
                    disabled={isPending}
                    onCheckedChange={() => handleComplete(task)}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{task.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                          {task.property_id ? (
                            <>
                              <Building2 className="h-4 w-4" />
                              <span>{task.property?.name}</span>
                            </>
                          ) : task.vehicle_id ? (
                            <>
                              <Car className="h-4 w-4" />
                              <span>
                                {task.vehicle?.year} {task.vehicle?.make}{" "}
                                {task.vehicle?.model}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            task.priority === "urgent"
                              ? "destructive"
                              : task.priority === "high"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                        <Badge variant="outline">{task.status}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingTask(task)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingTask(task)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {task.description && (
                      <p className="mt-2 text-base text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      {task.due_date && (
                        <span className="text-sm">
                          Due: {formatDate(task.due_date)}
                          {days !== null && days <= 7 && days >= 0 && (
                            <Badge variant="warning" className="ml-2">
                              {days === 0 ? "Today" : `${days}d`}
                            </Badge>
                          )}
                          {days !== null && days < 0 && (
                            <Badge variant="destructive" className="ml-2">
                              Overdue
                            </Badge>
                          )}
                        </span>
                      )}
                      {task.estimated_cost && (
                        <span className="text-sm text-muted-foreground">
                          Est. ${task.estimated_cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit Dialog */}
      <TaskFormDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        properties={properties}
        vehicles={vehicles}
        vendors={vendors}
        task={editingTask}
        onSuccess={() => setEditingTask(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTask?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
