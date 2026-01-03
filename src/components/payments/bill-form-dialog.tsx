"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FormField, FormSelect, FormTextarea, SubmitButton } from "@/components/forms"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createBill } from "@/lib/mutations"
import { billSchema, type BillFormData } from "@/lib/schemas"
import type { Property, Vehicle } from "@/types/database"

interface BillFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: Property[]
  vehicles: Vehicle[]
  onSuccess?: () => void
}

const BILL_TYPE_OPTIONS = [
  { value: "property_tax", label: "Property Tax" },
  { value: "insurance", label: "Insurance" },
  { value: "utility", label: "Utility" },
  { value: "maintenance", label: "Maintenance" },
  { value: "mortgage", label: "Mortgage" },
  { value: "hoa", label: "HOA" },
  { value: "other", label: "Other" },
]

const RECURRENCE_OPTIONS = [
  { value: "one_time", label: "One-Time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: "check", label: "Check" },
  { value: "auto_pay", label: "Auto Pay" },
  { value: "online", label: "Online" },
  { value: "wire", label: "Wire Transfer" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

export function BillFormDialog({
  open,
  onOpenChange,
  properties,
  vehicles,
  onSuccess,
}: BillFormDialogProps) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      bill_type: "other",
      recurrence: "one_time",
      days_to_confirm: 14,
      currency: "USD",
      status: "pending",
    },
  })

  const billType = watch("bill_type")
  const propertyId = watch("property_id")
  const vehicleId = watch("vehicle_id")
  const recurrence = watch("recurrence")
  const paymentMethod = watch("payment_method")

  useEffect(() => {
    if (!open) {
      reset({
        bill_type: "other",
        recurrence: "one_time",
        days_to_confirm: 14,
        currency: "USD",
        status: "pending",
      })
    }
  }, [open, reset])

  const onSubmit = async (data: BillFormData) => {
    const result = await createBill(data)

    if (result.success) {
      toast({
        title: "Bill added",
        description: "The bill has been added successfully.",
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
          <DialogTitle>Add Bill</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormSelect
            label="Bill Type"
            name="bill_type"
            value={billType}
            onChange={(value) => setValue("bill_type", value as BillFormData["bill_type"])}
            options={BILL_TYPE_OPTIONS}
            error={errors.bill_type?.message}
            required
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
              error={errors.property_id?.message}
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
              error={errors.vehicle_id?.message}
            />
          </div>

          <FormField
            label="Description"
            {...register("description")}
            error={errors.description?.message}
            placeholder="e.g., Q1 2024 Property Tax"
          />

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.amount?.message}
                  />
                )}
              />
              {errors.amount?.message && (
                <p className="text-sm text-red-500">{errors.amount.message}</p>
              )}
            </div>
            <FormField
              label="Due Date"
              type="date"
              {...register("due_date")}
              error={errors.due_date?.message}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <FormSelect
              label="Recurrence"
              name="recurrence"
              value={recurrence}
              onChange={(value) => setValue("recurrence", value as BillFormData["recurrence"])}
              options={RECURRENCE_OPTIONS}
              error={errors.recurrence?.message}
            />
            <FormSelect
              label="Payment Method"
              name="payment_method"
              value={paymentMethod || ""}
              onChange={(value) =>
                setValue("payment_method", (value || null) as BillFormData["payment_method"])
              }
              options={[{ value: "", label: "Not specified" }, ...PAYMENT_METHOD_OPTIONS]}
              error={errors.payment_method?.message}
            />
          </div>

          <FormField
            label="Days to Confirm"
            type="number"
            {...register("days_to_confirm")}
            error={errors.days_to_confirm?.message}
            description="Alert if payment not confirmed within this many days"
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
            <SubmitButton isLoading={isSubmitting}>Add Bill</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
