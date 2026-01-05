"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FormField, FormSelect, FormTextarea, SubmitButton } from "@/components/forms"
import { useToast } from "@/hooks/use-toast"
import { createVendor, updateVendor, updateVendorProperties } from "@/lib/mutations"
import { vendorSchema, type VendorFormData } from "@/lib/schemas"
import { getVendorSpecialtyOptions } from "@/types/database"
import type { Vendor, Property, VendorSpecialty } from "@/types/database"
import { Star, Home } from "lucide-react"

interface VendorFormProps {
  vendor?: Vendor
  properties?: Property[]
  assignedPropertyIds?: string[]
  onSuccess?: (vendor: Vendor) => void
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "check", label: "Check" },
  { value: "auto_pay", label: "Auto Pay" },
  { value: "online", label: "Online" },
  { value: "wire", label: "Wire Transfer" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

export function VendorForm({ vendor, properties = [], assignedPropertyIds = [], onSuccess }: VendorFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!vendor
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(assignedPropertyIds)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: vendor
      ? {
          name: vendor.name,
          company: vendor.company || "",
          specialties: vendor.specialties,
          phone: vendor.phone || "",
          email: vendor.email || "",
          address: vendor.address || "",
          website: vendor.website || "",
          emergency_phone: vendor.emergency_phone || "",
          account_number: vendor.account_number || "",
          payment_method: vendor.payment_method || undefined,
          login_info: vendor.login_info || "",
          notes: vendor.notes || "",
          rating: vendor.rating || undefined,
          is_active: vendor.is_active,
        }
      : {
          specialties: ["other"],
          is_active: true,
        },
  })

  const specialties = watch("specialties") || []
  const paymentMethod = watch("payment_method")
  const isActive = watch("is_active")
  const rating = watch("rating")
  const specialtyOptions = getVendorSpecialtyOptions()

  const onSubmit = async (data: VendorFormData) => {
    const result = isEditing
      ? await updateVendor(vendor.id, data)
      : await createVendor(data)

    if (result.success) {
      // Update property associations
      const vendorId = result.data.id
      const propResult = await updateVendorProperties(vendorId, selectedPropertyIds)

      if (!propResult.success) {
        toast({
          title: "Warning",
          description: "Vendor saved but property associations failed to update.",
          variant: "destructive",
        })
      }

      toast({
        title: isEditing ? "Vendor updated" : "Vendor created",
        description: `${data.name} has been ${isEditing ? "updated" : "added"} successfully.`,
      })

      if (onSuccess) {
        onSuccess(result.data)
      } else {
        router.push(`/vendors/${result.data.id}`)
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Vendor Name"
              {...register("name")}
              error={errors.name?.message}
              placeholder="ABC Plumbing Inc."
              required
            />
            <FormField
              label="DBA / Trade Name"
              {...register("company")}
              error={errors.company?.message}
              placeholder="Optional alternate name"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Specialties <span className="text-red-500">*</span>
            </Label>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-h-64 overflow-y-auto p-3 border rounded-lg bg-muted/30">
              {specialtyOptions.map((option) => (
                <label
                  key={option.value}
                  htmlFor={`specialty-${option.value}`}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground"
                >
                  <Checkbox
                    id={`specialty-${option.value}`}
                    checked={specialties.includes(option.value)}
                    onCheckedChange={(checked) => {
                      const newSpecialties = checked
                        ? [...specialties, option.value]
                        : specialties.filter((s: VendorSpecialty) => s !== option.value)
                      setValue("specialties", newSpecialties.length > 0 ? newSpecialties : ["other"])
                    }}
                  />
                  <span className={specialties.includes(option.value) ? "font-medium" : "text-muted-foreground"}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
            {errors.specialties?.message && (
              <p className="text-sm text-red-500">{errors.specialties.message}</p>
            )}
            {specialties.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {specialties.length} specialt{specialties.length === 1 ? 'y' : 'ies'} selected
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", !!checked)}
            />
            <Label htmlFor="is_active">Active vendor</Label>
          </div>
        </CardContent>
      </Card>

      {/* Properties Served */}
      {properties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Properties Served
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Select the properties this vendor services. Location will be auto-derived from assigned properties.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <label
                  key={property.id}
                  htmlFor={`property-${property.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    id={`property-${property.id}`}
                    checked={selectedPropertyIds.includes(property.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPropertyIds(prev => [...prev, property.id])
                      } else {
                        setSelectedPropertyIds(prev => prev.filter(id => id !== property.id))
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">
                      {property.name}
                    </span>
                    <p className="text-sm text-muted-foreground truncate">
                      {property.city}, {property.state || property.country}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            {selectedPropertyIds.length > 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                {selectedPropertyIds.length} propert{selectedPropertyIds.length === 1 ? 'y' : 'ies'} selected
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Phone"
              type="tel"
              {...register("phone")}
              error={errors.phone?.message}
              placeholder="(555) 123-4567"
            />
            <FormField
              label="Emergency Phone"
              type="tel"
              {...register("emergency_phone")}
              error={errors.emergency_phone?.message}
              placeholder="(555) 987-6543"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Email"
              type="email"
              {...register("email")}
              error={errors.email?.message}
              placeholder="john@abcplumbing.com"
            />
            <FormField
              label="Website"
              type="url"
              {...register("website")}
              error={errors.website?.message}
              placeholder="https://abcplumbing.com"
            />
          </div>

          <FormField
            label="Address"
            {...register("address")}
            error={errors.address?.message}
            placeholder="123 Business Lane, City, State ZIP"
          />
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Account Number"
              {...register("account_number")}
              error={errors.account_number?.message}
            />
            <FormSelect
              label="Payment Method"
              name="payment_method"
              value={paymentMethod || ""}
              onChange={(value) =>
                setValue("payment_method", value as VendorFormData["payment_method"])
              }
              options={PAYMENT_METHOD_OPTIONS}
              error={errors.payment_method?.message}
              placeholder="Select payment method..."
            />
          </div>

          <FormTextarea
            label="Login Info"
            {...register("login_info")}
            error={errors.login_info?.message}
            placeholder="Portal login credentials or access notes..."
            rows={2}
          />
        </CardContent>
      </Card>

      {/* Rating & Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Rating & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setValue("rating", star === rating ? undefined : star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-6 w-6 ${
                      rating && star <= rating
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
              {rating && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {rating} star{rating !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <FormTextarea
            label="Notes"
            {...register("notes")}
            error={errors.notes?.message}
            placeholder="Additional notes about this vendor..."
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
          {isEditing ? "Save Changes" : "Create Vendor"}
        </SubmitButton>
      </div>
    </form>
  )
}
