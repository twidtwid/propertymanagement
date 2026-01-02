"use client"

import { useState, useTransition } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { toggleSharedTaskItem } from "@/lib/mutations"
import { formatDate } from "@/lib/utils"
import { TASK_PRIORITY_LABELS } from "@/types/database"
import type { SharedTaskItem } from "@/types/database"
import { cn } from "@/lib/utils"

interface TaskItemListProps {
  listId: string
  items: SharedTaskItem[]
}

export function TaskItemList({ listId, items }: TaskItemListProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [localItems, setLocalItems] = useState(items)

  const handleToggle = async (itemId: string) => {
    // Optimistic update
    setLocalItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, is_completed: !item.is_completed }
          : item
      )
    )

    startTransition(async () => {
      const result = await toggleSharedTaskItem(itemId)
      if (!result.success) {
        // Revert on error
        setLocalItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, is_completed: !item.is_completed }
              : item
          )
        )
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    })
  }

  // Sort: incomplete first, then by sort_order
  const sortedItems = [...localItems].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1
    }
    return (a.sort_order || 0) - (b.sort_order || 0)
  })

  return (
    <div className="space-y-2">
      {sortedItems.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border transition-colors",
            item.is_completed && "bg-muted/50"
          )}
        >
          <Checkbox
            checked={item.is_completed}
            onCheckedChange={() => handleToggle(item.id)}
            disabled={isPending}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-base",
                item.is_completed && "line-through text-muted-foreground"
              )}
            >
              {item.task}
            </p>
            {item.notes && (
              <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant={
                  item.priority === "urgent"
                    ? "destructive"
                    : item.priority === "high"
                    ? "warning"
                    : "secondary"
                }
                className="text-xs"
              >
                {TASK_PRIORITY_LABELS[item.priority]}
              </Badge>
              {item.completed_date && (
                <span className="text-xs text-muted-foreground">
                  Completed {formatDate(item.completed_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
