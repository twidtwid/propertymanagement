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
import { FormField, FormSelect, SubmitButton } from "@/components/forms"
import { useToast } from "@/hooks/use-toast"
import { createSharedTaskList } from "@/lib/mutations"
import { sharedTaskListSchema, type SharedTaskListFormData } from "@/lib/schemas"
import type { Property } from "@/types/database"

interface SharedTaskListFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: Property[]
  defaultPropertyId?: string
  onSuccess?: () => void
}

export function SharedTaskListFormDialog({
  open,
  onOpenChange,
  properties,
  defaultPropertyId,
  onSuccess,
}: SharedTaskListFormDialogProps) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SharedTaskListFormData>({
    resolver: zodResolver(sharedTaskListSchema),
    defaultValues: {
      property_id: defaultPropertyId || "",
      is_active: true,
    },
  })

  const propertyId = watch("property_id")

  useEffect(() => {
    if (!open) {
      reset({
        property_id: defaultPropertyId || "",
        is_active: true,
      })
    }
  }, [open, reset, defaultPropertyId])

  const onSubmit = async (data: SharedTaskListFormData) => {
    const result = await createSharedTaskList(data)

    if (result.success) {
      toast({
        title: "Task list created",
        description: "The shared task list has been created.",
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task List</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormSelect
            label="Property"
            name="property_id"
            value={propertyId}
            onChange={(value) => setValue("property_id", value)}
            options={properties.map((p) => ({ value: p.id, label: p.name }))}
            error={errors.property_id?.message}
            required
          />

          <FormField
            label="Title"
            {...register("title")}
            error={errors.title?.message}
            placeholder="e.g., Spring Maintenance List"
            required
          />

          <FormField
            label="Assigned To"
            {...register("assigned_to")}
            error={errors.assigned_to?.message}
            placeholder="e.g., Justin (Parker Construction)"
          />

          <FormField
            label="Contact Info"
            {...register("assigned_contact")}
            error={errors.assigned_contact?.message}
            placeholder="Phone or email"
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton isLoading={isSubmitting}>Create List</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
