"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FormField, FormTextarea, SubmitButton } from "@/components/forms"
import { useToast } from "@/hooks/use-toast"
import { createVehicle, updateVehicle } from "@/lib/mutations"
import { vehicleSchema, type VehicleFormData } from "@/lib/schemas"
import type { Vehicle } from "@/types/database"

interface VehicleFormProps {
  vehicle?: Vehicle
  onSuccess?: (vehicle: Vehicle) => void
}

export function VehicleForm({ vehicle, onSuccess }: VehicleFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!vehicle

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicle
      ? {
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color || "",
          vin: vehicle.vin || "",
          license_plate: vehicle.license_plate || "",
          registration_state: vehicle.registration_state || "RI",
          registration_expires: vehicle.registration_expires || "",
          inspection_expires: vehicle.inspection_expires || "",
          garage_location: vehicle.garage_location || "",
          notes: vehicle.notes || "",
          is_active: vehicle.is_active,
        }
      : {
          year: new Date().getFullYear(),
          registration_state: "RI",
          is_active: true,
        },
  })

  const isActive = watch("is_active")

  const onSubmit = async (data: VehicleFormData) => {
    const result = isEditing
      ? await updateVehicle(vehicle.id, data)
      : await createVehicle(data)

    if (result.success) {
      toast({
        title: isEditing ? "Vehicle updated" : "Vehicle created",
        description: `${data.year} ${data.make} ${data.model} has been ${isEditing ? "updated" : "added"} successfully.`,
      })

      if (onSuccess) {
        onSuccess(result.data)
      } else {
        router.push(`/vehicles/${result.data.id}`)
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
      {/* Vehicle Information */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              label="Year"
              type="number"
              {...register("year")}
              error={errors.year?.message}
              min={1900}
              max={2100}
              required
            />
            <FormField
              label="Make"
              {...register("make")}
              error={errors.make?.message}
              placeholder="Chevrolet"
              required
            />
            <FormField
              label="Model"
              {...register("model")}
              error={errors.model?.message}
              placeholder="Equinox"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Color"
              {...register("color")}
              error={errors.color?.message}
              placeholder="Black"
            />
            <FormField
              label="VIN"
              {...register("vin")}
              error={errors.vin?.message}
              placeholder="1GNKVLKD4DJ103781"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", !!checked)}
            />
            <Label htmlFor="is_active">Active vehicle</Label>
          </div>
        </CardContent>
      </Card>

      {/* Registration */}
      <Card>
        <CardHeader>
          <CardTitle>Registration & Inspection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="License Plate"
              {...register("license_plate")}
              error={errors.license_plate?.message}
              placeholder="ABC-1234"
            />
            <FormField
              label="Registration State"
              {...register("registration_state")}
              error={errors.registration_state?.message}
              placeholder="RI"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Registration Expires"
              type="date"
              {...register("registration_expires")}
              error={errors.registration_expires?.message}
            />
            <FormField
              label="Inspection Expires"
              type="date"
              {...register("inspection_expires")}
              error={errors.inspection_expires?.message}
            />
          </div>
        </CardContent>
      </Card>

      {/* Location & Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Location & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            label="Garage Location"
            {...register("garage_location")}
            error={errors.garage_location?.message}
            placeholder="NYC Garage spot #43"
          />

          <FormTextarea
            label="Notes"
            {...register("notes")}
            error={errors.notes?.message}
            placeholder="Additional notes about this vehicle..."
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
          {isEditing ? "Save Changes" : "Create Vehicle"}
        </SubmitButton>
      </div>
    </form>
  )
}
