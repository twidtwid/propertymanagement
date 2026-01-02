"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Phone, Mail, User } from "lucide-react"
import type { Property, Vendor } from "@/types/database"
import { getVendorSpecialtyOptions } from "@/types/database"

interface QuickContactProps {
  properties: Property[]
}

export function QuickContact({ properties }: QuickContactProps) {
  const [selectedProperty, setSelectedProperty] = useState<string>("")
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("")
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchVendor() {
      if (!selectedProperty || !selectedSpecialty) {
        setVendor(null)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/vendors/lookup?propertyId=${selectedProperty}&specialty=${selectedSpecialty}`
        )
        if (response.ok) {
          const data = await response.json()
          setVendor(data)
        } else {
          setVendor(null)
        }
      } catch (error) {
        console.error("Error fetching vendor:", error)
        setVendor(null)
      } finally {
        setLoading(false)
      }
    }

    fetchVendor()
  }, [selectedProperty, selectedSpecialty])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Who Do I Call?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger>
            <SelectValue placeholder="Select property..." />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
          <SelectTrigger>
            <SelectValue placeholder="Select service type..." />
          </SelectTrigger>
          <SelectContent>
            {getVendorSpecialtyOptions().map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loading && (
          <div className="text-center py-4 text-muted-foreground">
            Searching...
          </div>
        )}

        {!loading && vendor && (
          <div className="p-4 border rounded-xl bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold">{vendor.name}</h4>
                {vendor.company && (
                  <p className="text-base text-muted-foreground">{vendor.company}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {vendor.phone && (
                <Button size="lg" className="flex-1" asChild>
                  <a href={`tel:${vendor.phone}`}>
                    <Phone className="w-5 h-5 mr-2" />
                    Call
                  </a>
                </Button>
              )}
              {vendor.email && (
                <Button size="lg" variant="outline" className="flex-1" asChild>
                  <a href={`mailto:${vendor.email}`}>
                    <Mail className="w-5 h-5 mr-2" />
                    Email
                  </a>
                </Button>
              )}
            </div>
            {vendor.emergency_phone && (
              <p className="text-sm text-muted-foreground mt-3">
                Emergency: {vendor.emergency_phone}
              </p>
            )}
          </div>
        )}

        {!loading && !vendor && selectedProperty && selectedSpecialty && (
          <div className="text-center py-4 text-muted-foreground">
            No vendor found for this property and service type.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
