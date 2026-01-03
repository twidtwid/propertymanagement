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
import { createPropertyTax, updatePropertyTax } from "@/lib/mutations"
import { propertyTaxSchema, type PropertyTaxFormData } from "@/lib/schemas"
import type { Property, PropertyTax } from "@/types/database"

interface TaxFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: Property[]
  tax?: PropertyTax & { property_name?: string }
  onSuccess?: () => void
}

const INSTALLMENT_OPTIONS = [
  { value: "1", label: "Q1 / First Half" },
  { value: "2", label: "Q2 / Second Half" },
  { value: "3", label: "Q3" },
  { value: "4", label: "Q4" },
]

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "confirmed", label: "Confirmed" },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "check", label: "Check" },
  { value: "auto_pay", label: "Auto Pay" },
  { value: "online", label: "Online" },
  { value: "wire", label: "Wire Transfer" },
]

export function TaxFormDialog({
  open,
  onOpenChange,
  properties,
  tax,
  onSuccess,
}: TaxFormDialogProps) {
  const { toast } = useToast()
  const isEditing = !!tax

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PropertyTaxFormData>({
    resolver: zodResolver(propertyTaxSchema),
    defaultValues: {
      installment: 1,
      status: "pending",
    },
  })

  const propertyId = watch("property_id")
  const status = watch("status")
  const installment = watch("installment")

  useEffect(() => {
    if (open) {
      if (tax) {
        reset({
          property_id: tax.property_id,
          tax_year: tax.tax_year,
          jurisdiction: tax.jurisdiction,
          installment: tax.installment,
          amount: Number(tax.amount),
          due_date: tax.due_date,
          payment_url: tax.payment_url || "",
          status: tax.status as PropertyTaxFormData["status"],
          payment_date: tax.payment_date || "",
          confirmation_date: tax.confirmation_date || "",
          notes: tax.notes || "",
        })
      } else {
        reset({
          installment: 1,
          status: "pending",
          tax_year: new Date().getFullYear(),
        })
      }
    }
  }, [open, tax, reset])

  const onSubmit = async (data: PropertyTaxFormData) => {
    const result = isEditing
      ? await updatePropertyTax(tax!.id, data)
      : await createPropertyTax(data)

    if (result.success) {
      toast({
        title: isEditing ? "Tax updated" : "Tax added",
        description: isEditing
          ? "The property tax has been updated."
          : "The property tax has been added.",
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
          <DialogTitle>{isEditing ? "Edit Property Tax" : "Add Property Tax"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormSelect
            label="Property"
            name="property_id"
            value={propertyId || ""}
            onChange={(value) => setValue("property_id", value)}
            options={properties.map((p) => ({ value: p.id, label: p.name }))}
            error={errors.property_id?.message}
            required
          />

          <div className="grid gap-4 grid-cols-2">
            <FormField
              label="Jurisdiction"
              {...register("jurisdiction")}
              error={errors.jurisdiction?.message}
              placeholder="e.g., Providence, RI"
            />
            <FormField
              label="Tax Year"
              type="number"
              {...register("tax_year")}
              error={errors.tax_year?.message}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <FormSelect
              label="Installment"
              name="installment"
              value={String(installment)}
              onChange={(value) => setValue("installment", parseInt(value))}
              options={INSTALLMENT_OPTIONS}
              error={errors.installment?.message}
            />
            <FormField
              label="Due Date"
              type="date"
              {...register("due_date")}
              error={errors.due_date?.message}
              required
            />
          </div>

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
            <FormSelect
              label="Status"
              name="status"
              value={status}
              onChange={(value) => setValue("status", value as PropertyTaxFormData["status"])}
              options={STATUS_OPTIONS}
              error={errors.status?.message}
            />
          </div>

          {(status === "sent" || status === "confirmed") && (
            <div className="grid gap-4 grid-cols-2">
              <FormField
                label="Payment Date"
                type="date"
                {...register("payment_date")}
                error={errors.payment_date?.message}
              />
              {status === "confirmed" && (
                <FormField
                  label="Confirmation Date"
                  type="date"
                  {...register("confirmation_date")}
                  error={errors.confirmation_date?.message}
                />
              )}
            </div>
          )}

          <FormField
            label="Payment URL"
            {...register("payment_url")}
            error={errors.payment_url?.message}
            placeholder="https://..."
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
              {isEditing ? "Save Changes" : "Add Tax"}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
