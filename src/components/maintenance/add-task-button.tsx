"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TaskFormDialog } from "./task-form-dialog"
import type { Property, Vehicle, Vendor } from "@/types/database"

interface AddTaskButtonProps {
  properties: Property[]
  vehicles: Vehicle[]
  vendors: Vendor[]
}

export function AddTaskButton({ properties, vehicles, vendors }: AddTaskButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5 mr-2" />
        Add Task
      </Button>
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        properties={properties}
        vehicles={vehicles}
        vendors={vendors}
      />
    </>
  )
}
