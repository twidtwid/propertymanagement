"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ticketSchema, type TicketFormData } from "@/lib/schemas"
import { createTicket, updateTicket } from "@/lib/mutations"
import { getVendorContacts } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"
import { TASK_PRIORITY_LABELS } from "@/types/database"
import type { Property, Vehicle, Vendor, VendorContact, MaintenanceTask } from "@/types/database"
import { PhotoUpload } from "./photo-upload"
import { VendorCombobox } from "@/components/vendors/vendor-combobox"

interface TicketFormProps {
  properties: Property[]
  vehicles: Vehicle[]
  vendors: Vendor[]
  ticket?: MaintenanceTask // For edit mode
}

export function TicketForm({ properties, vehicles, vendors, ticket }: TicketFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [vendorContacts, setVendorContacts] = useState<VendorContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [stagedPhotos, setStagedPhotos] = useState<File[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const isEditing = !!ticket

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: ticket?.title || "",
      description: ticket?.description || "",
      property_id: ticket?.property_id || null,
      vehicle_id: ticket?.vehicle_id || null,
      vendor_id: ticket?.vendor_id || null,
      vendor_contact_id: ticket?.vendor_contact_id || null,
      priority: ticket?.priority || "medium",
      due_date: ticket?.due_date || null,
      estimated_cost: ticket?.estimated_cost || null,
    },
  })

  const watchVendorId = form.watch("vendor_id")

  // Load vendor contacts when vendor changes
  useEffect(() => {
    if (watchVendorId) {
      setLoadingContacts(true)
      getVendorContacts(watchVendorId).then((contacts) => {
        setVendorContacts(contacts)
        setLoadingContacts(false)
      })
    } else {
      setVendorContacts([])
      form.setValue("vendor_contact_id", null)
    }
  }, [watchVendorId, form])

  const uploadPhotos = async (ticketId: string) => {
    if (stagedPhotos.length === 0) return

    setUploadingPhotos(true)
    try {
      for (const file of stagedPhotos) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("path", `/Tickets/${ticketId}`)

        const response = await fetch("/api/dropbox/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          console.error("Failed to upload photo:", file.name)
        }
      }
    } catch (error) {
      console.error("Error uploading photos:", error)
    } finally {
      setUploadingPhotos(false)
    }
  }

  const onSubmit = (data: TicketFormData) => {
    startTransition(async () => {
      const result = isEditing
        ? await updateTicket(ticket.id, data)
        : await createTicket(data)

      if (result.success) {
        // Upload photos if any were staged (only for new tickets)
        if (!isEditing && stagedPhotos.length > 0) {
          await uploadPhotos(result.data!.id)
        }

        toast({
          title: isEditing ? "Ticket updated" : "Ticket created",
          description: isEditing
            ? "Your changes have been saved."
            : `"${data.title}" has been created.`,
        })

        // Small delay for new tickets to ensure server-side cache invalidation
        // completes before navigation (helps with mobile/slower networks)
        if (!isEditing) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        router.push(isEditing ? `/tickets/${ticket.id}` : `/tickets/${result.data!.id}`)
      } else {
        toast({
          title: "Error",
          description: result.error || "Something went wrong",
          variant: "destructive",
        })
      }
    })
  }

  // Create combined list for property/vehicle selector
  const locationOptions = [
    ...properties.map((p) => ({ type: "property" as const, id: p.id, name: p.name })),
    ...vehicles.map((v) => ({
      type: "vehicle" as const,
      id: v.id,
      name: `${v.year} ${v.make} ${v.model}`,
    })),
  ]

  const currentLocationId = form.watch("property_id") || form.watch("vehicle_id") || "__none__"

  const handleLocationChange = (value: string) => {
    if (value === "__none__") {
      form.setValue("property_id", null)
      form.setValue("vehicle_id", null)
      return
    }
    const option = locationOptions.find((o) => o.id === value)
    if (option?.type === "property") {
      form.setValue("property_id", value)
      form.setValue("vehicle_id", null)
    } else if (option?.type === "vehicle") {
      form.setValue("vehicle_id", value)
      form.setValue("property_id", null)
    } else {
      form.setValue("property_id", null)
      form.setValue("vehicle_id", null)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Ticket" : "New Ticket"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              What needs to be fixed? <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Basement fridge not working"
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Property or Vehicle</Label>
            <Select value={currentLocationId} onValueChange={handleLocationChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {properties.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Properties
                    </div>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {vehicles.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Vehicles
                    </div>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <Label htmlFor="vendor">Assign to Vendor</Label>
            <VendorCombobox
              vendors={vendors}
              value={form.watch("vendor_id")}
              onValueChange={(value) => form.setValue("vendor_id", value)}
              placeholder="Search vendors..."
            />
          </div>

          {/* Vendor Contact */}
          {watchVendorId && (
            <div className="space-y-2">
              <Label htmlFor="vendorContact">Contact at Vendor</Label>
              <Select
                value={form.watch("vendor_contact_id") || "__none__"}
                onValueChange={(value) => form.setValue("vendor_contact_id", value === "__none__" ? null : value)}
                disabled={loadingContacts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingContacts ? "Loading..." : "Select contact..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any contact</SelectItem>
                  {vendorContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.is_primary && " (Primary)"}
                      {c.title && ` · ${c.title}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="flex flex-wrap gap-2">
              {(["low", "medium", "high", "urgent"] as const).map((priority) => (
                <Button
                  key={priority}
                  type="button"
                  variant={form.watch("priority") === priority ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    form.watch("priority") === priority && priority === "urgent" && "bg-red-600 hover:bg-red-700",
                    form.watch("priority") === priority && priority === "high" && "bg-orange-500 hover:bg-orange-600"
                  )}
                  onClick={() => form.setValue("priority", priority)}
                >
                  {TASK_PRIORITY_LABELS[priority]}
                </Button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Need By Date (optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={form.watch("due_date") || ""}
              onChange={(e) => form.setValue("due_date", e.target.value || null)}
            />
            <p className="text-xs text-muted-foreground">
              When does this need to be completed? (Shows on calendar)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Additional details about the issue..."
              rows={4}
              {...form.register("description")}
            />
          </div>

          {/* Estimated Cost */}
          <div className="space-y-2">
            <Label htmlFor="estimatedCost">Estimated Cost (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="estimatedCost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7"
                {...form.register("estimated_cost", { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Photos (only for new tickets) */}
          {!isEditing && (
            <PhotoUpload
              onPhotosChange={setStagedPhotos}
              disabled={isPending || uploadingPhotos}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || uploadingPhotos}>
          {uploadingPhotos
            ? "Uploading photos..."
            : isPending
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Ticket"}
        </Button>
      </div>
    </form>
  )
}
