"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FormField, FormSelect, FormTextarea, SubmitButton } from "@/components/forms"
import { CurrencyInput } from "@/components/ui/currency-input"
import { useToast } from "@/hooks/use-toast"
import { createProperty, updateProperty } from "@/lib/mutations"
import { propertySchema, type PropertyFormData } from "@/lib/schemas"
import { PROPERTY_TYPE_LABELS } from "@/types/database"
import type { Property } from "@/types/database"

interface PropertyFormProps {
  property?: Property
  onSuccess?: (property: Property) => void
}

const PROPERTY_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "sold", label: "Sold" },
]

export function PropertyForm({ property, onSuccess }: PropertyFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!property

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: property
      ? {
          name: property.name,
          address: property.address,
          city: property.city,
          state: property.state || "",
          country: property.country || "USA",
          postal_code: property.postal_code || "",
          property_type: property.property_type,
          square_feet: property.square_feet || undefined,
          purchase_date: property.purchase_date || "",
          purchase_price: property.purchase_price || undefined,
          current_value: property.current_value || undefined,
          span_number: property.span_number || "",
          block_number: property.block_number || "",
          lot_number: property.lot_number || "",
          parcel_id: property.parcel_id || "",
          tax_lookup_url: property.tax_lookup_url || "",
          has_mortgage: property.has_mortgage || false,
          mortgage_lender: property.mortgage_lender || "",
          mortgage_account: property.mortgage_account || "",
          mortgage_payment: property.mortgage_payment || undefined,
          mortgage_due_day: property.mortgage_due_day || undefined,
          notes: property.notes || "",
          status: property.status,
        }
      : {
          country: "USA",
          property_type: "house",
          has_mortgage: false,
          status: "active",
        },
  })

  const hasMortgage = watch("has_mortgage")
  const propertyType = watch("property_type")
  const status = watch("status")

  const onSubmit = async (data: PropertyFormData) => {
    const result = isEditing
      ? await updateProperty(property.id, data)
      : await createProperty(data)

    if (result.success) {
      toast({
        title: isEditing ? "Property updated" : "Property created",
        description: `${data.name} has been ${isEditing ? "updated" : "added"} successfully.`,
      })

      if (onSuccess) {
        onSuccess(result.data)
      } else {
        router.push(`/properties/${result.data.id}`)
      }
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Property Name"
              {...register("name")}
              error={errors.name?.message}
              placeholder="e.g., Vermont Main House"
              required
            />
            <FormSelect
              label="Type"
              name="property_type"
              value={propertyType}
              onChange={(value) =>
                setValue("property_type", value as PropertyFormData["property_type"])
              }
              options={Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              error={errors.property_type?.message}
              required
            />
          </div>

          <FormField
            label="Street Address"
            {...register("address")}
            error={errors.address?.message}
            placeholder="123 Main Street"
          />

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              label="City"
              {...register("city")}
              error={errors.city?.message}
            />
            <FormField
              label="State/Province"
              {...register("state")}
              error={errors.state?.message}
            />
            <FormField
              label="Country"
              {...register("country")}
              error={errors.country?.message}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Postal Code"
              {...register("postal_code")}
              error={errors.postal_code?.message}
            />
            <FormField
              label="Square Feet"
              type="number"
              {...register("square_feet")}
              error={errors.square_feet?.message}
            />
          </div>

          <FormSelect
            label="Status"
            name="status"
            value={status}
            onChange={(value) =>
              setValue("status", value as PropertyFormData["status"])
            }
            options={PROPERTY_STATUS_OPTIONS}
            error={errors.status?.message}
          />
        </CardContent>
      </Card>

      {/* Tax Identifiers */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Identifiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="SPAN Number (VT)"
              {...register("span_number")}
              error={errors.span_number?.message}
              description="Vermont School Property Account Number"
            />
            <FormField
              label="Parcel ID"
              {...register("parcel_id")}
              error={errors.parcel_id?.message}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Block Number (NYC)"
              {...register("block_number")}
              error={errors.block_number?.message}
            />
            <FormField
              label="Lot Number (NYC)"
              {...register("lot_number")}
              error={errors.lot_number?.message}
            />
          </div>
          <FormField
            label="Tax Lookup URL"
            {...register("tax_lookup_url")}
            error={errors.tax_lookup_url?.message}
            placeholder="https://..."
            description="Link to official tax lookup portal for this property"
          />
        </CardContent>
      </Card>

      {/* Mortgage Information */}
      <Card>
        <CardHeader>
          <CardTitle>Mortgage Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="has_mortgage"
              checked={hasMortgage}
              onCheckedChange={(checked) => setValue("has_mortgage", !!checked)}
            />
            <Label htmlFor="has_mortgage">This property has a mortgage</Label>
          </div>

          {hasMortgage && (
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <FormField
                label="Lender"
                {...register("mortgage_lender")}
                error={errors.mortgage_lender?.message}
              />
              <FormField
                label="Account Number"
                {...register("mortgage_account")}
                error={errors.mortgage_account?.message}
              />
              <div className="space-y-2">
                <Label>Monthly Payment</Label>
                <Controller
                  name="mortgage_payment"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.mortgage_payment?.message}
                    />
                  )}
                />
                {errors.mortgage_payment?.message && (
                  <p className="text-sm text-red-500">{errors.mortgage_payment.message}</p>
                )}
              </div>
              <FormField
                label="Due Day of Month"
                type="number"
                min="1"
                max="31"
                {...register("mortgage_due_day")}
                error={errors.mortgage_due_day?.message}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Information */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              label="Purchase Date"
              type="date"
              {...register("purchase_date")}
              error={errors.purchase_date?.message}
            />
            <div className="space-y-2">
              <Label>Purchase Price</Label>
              <Controller
                name="purchase_price"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.purchase_price?.message}
                  />
                )}
              />
              {errors.purchase_price?.message && (
                <p className="text-sm text-red-500">{errors.purchase_price.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Current Value</Label>
              <Controller
                name="current_value"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.current_value?.message}
                  />
                )}
              />
              {errors.current_value?.message && (
                <p className="text-sm text-red-500">{errors.current_value.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <FormTextarea
            label="Additional Notes"
            {...register("notes")}
            placeholder="Additional notes about this property..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <SubmitButton isLoading={isSubmitting} size="lg">
          {isEditing ? "Save Changes" : "Create Property"}
        </SubmitButton>
      </div>
    </form>
  )
}
