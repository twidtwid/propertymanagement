"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FormField, FormSelect, FormTextarea, SubmitButton } from "@/components/forms"
import { useToast } from "@/hooks/use-toast"
import { createMaintenanceTask, updateMaintenanceTask } from "@/lib/mutations"
import { maintenanceTaskSchema, type MaintenanceTaskFormData } from "@/lib/schemas"
import type { Property, Vehicle, Vendor, MaintenanceTask } from "@/types/database"

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: Property[]
  vehicles: Vehicle[]
  vendors: Vendor[]
  defaultPropertyId?: string
  task?: MaintenanceTask | null
  onSuccess?: () => void
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

const RECURRENCE_OPTIONS = [
  { value: "one_time", label: "One-Time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
]

export function TaskFormDialog({
  open,
  onOpenChange,
  properties,
  vehicles,
  vendors,
  defaultPropertyId,
  task,
  onSuccess,
}: TaskFormDialogProps) {
  const { toast } = useToast()
  const isEditing = !!task

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceTaskFormData>({
    resolver: zodResolver(maintenanceTaskSchema),
    defaultValues: {
      priority: "medium",
      status: "pending",
      recurrence: "one_time",
      property_id: defaultPropertyId || undefined,
    },
  })

  const propertyId = watch("property_id")
  const vehicleId = watch("vehicle_id")
  const vendorId = watch("vendor_id")
  const priority = watch("priority")
  const status = watch("status")
  const recurrence = watch("recurrence")

  useEffect(() => {
    if (open && task) {
      // Populate form with existing task data
      reset({
        title: task.title,
        description: task.description || undefined,
        property_id: task.property_id || undefined,
        vehicle_id: task.vehicle_id || undefined,
        vendor_id: task.vendor_id || undefined,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date || undefined,
        recurrence: task.recurrence,
        estimated_cost: task.estimated_cost || undefined,
        notes: task.notes || undefined,
      })
    } else if (!open) {
      reset({
        priority: "medium",
        status: "pending",
        recurrence: "one_time",
        property_id: defaultPropertyId || undefined,
      })
    }
  }, [open, task, reset, defaultPropertyId])

  const onSubmit = async (data: MaintenanceTaskFormData) => {
    const result = isEditing
      ? await updateMaintenanceTask(task.id, data)
      : await createMaintenanceTask(data)

    if (result.success) {
      toast({
        title: isEditing ? "Task updated" : "Task created",
        description: isEditing
          ? "The maintenance task has been updated."
          : "The maintenance task has been created.",
      })
      onOpenChange(false)
      onSuccess?.()
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Add Maintenance Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Title"
            {...register("title")}
            error={errors.title?.message}
            placeholder="e.g., Fix leaky faucet"
          />

          <FormTextarea
            label="Description"
            {...register("description")}
            error={errors.description?.message}
            placeholder="Details about the task..."
            rows={2}
          />

          <div className="grid gap-4 grid-cols-2">
            <FormSelect
              label="Property"
              name="property_id"
              value={propertyId || ""}
              onChange={(value) => {
                setValue("property_id", value || null)
                if (value) setValue("vehicle_id", null)
              }}
              options={[
                { value: "", label: "None" },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <FormSelect
              label="Vehicle"
              name="vehicle_id"
              value={vehicleId || ""}
              onChange={(value) => {
                setValue("vehicle_id", value || null)
                if (value) setValue("property_id", null)
              }}
              options={[
                { value: "", label: "None" },
                ...vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.year} ${v.make} ${v.model}`,
                })),
              ]}
            />
          </div>

          <FormSelect
            label="Assign to Vendor"
            name="vendor_id"
            value={vendorId || ""}
            onChange={(value) => setValue("vendor_id", value || null)}
            options={[
              { value: "", label: "Not assigned" },
              ...vendors.map((v) => ({
                value: v.id,
                label: v.company ? `${v.name} (${v.company})` : v.name,
              })),
            ]}
          />

          <div className="grid gap-4 grid-cols-2">
            <FormSelect
              label="Priority"
              name="priority"
              value={priority}
              onChange={(value) => setValue("priority", value as MaintenanceTaskFormData["priority"])}
              options={PRIORITY_OPTIONS}
              error={errors.priority?.message}
            />
            <FormSelect
              label="Status"
              name="status"
              value={status}
              onChange={(value) => setValue("status", value as MaintenanceTaskFormData["status"])}
              options={STATUS_OPTIONS}
              error={errors.status?.message}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <FormField
              label="Due Date"
              type="date"
              {...register("due_date")}
              error={errors.due_date?.message}
            />
            <FormSelect
              label="Recurrence"
              name="recurrence"
              value={recurrence}
              onChange={(value) => setValue("recurrence", value as MaintenanceTaskFormData["recurrence"])}
              options={RECURRENCE_OPTIONS}
              error={errors.recurrence?.message}
            />
          </div>

          <FormField
            label="Estimated Cost"
            type="number"
            step="0.01"
            {...register("estimated_cost")}
            error={errors.estimated_cost?.message}
          />

          <FormTextarea
            label="Notes"
            {...register("notes")}
            placeholder="Additional notes..."
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton isLoading={isSubmitting}>
              {isEditing ? "Save Changes" : "Create Task"}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
