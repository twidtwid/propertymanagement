"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Phone, Mail, Search, User, Loader2, Star } from "lucide-react"
import type { Property, Vendor, VendorSpecialty } from "@/types/database"
import { VENDOR_SPECIALTY_LABELS, getVendorSpecialtyOptions } from "@/types/database"

interface QuickContactModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: Property[]
  pinnedVendors?: Vendor[]
}

export function QuickContactModal({
  open,
  onOpenChange,
  properties,
  pinnedVendors = [],
}: QuickContactModalProps) {
  const [search, setSearch] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<string>("")
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("")
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<Vendor[]>([])

  // Search for vendors by name
  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/vendors/search?q=${encodeURIComponent(search)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.slice(0, 5))
        }
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [search])

  // Lookup vendor by property + specialty
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
        console.error("Lookup error:", error)
        setVendor(null)
      } finally {
        setLoading(false)
      }
    }

    fetchVendor()
  }, [selectedProperty, selectedSpecialty])

  const handleSelectVendor = (v: Vendor) => {
    setVendor(v)
    setSearch("")
    setSearchResults([])
  }

  const handleReset = () => {
    setVendor(null)
    setSearch("")
    setSearchResults([])
    setSelectedProperty("")
    setSelectedSpecialty("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Who Do I Call?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pinned Vendors Quick Access */}
          {pinnedVendors.length > 0 && !vendor && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pinned vendors:</p>
              <div className="flex flex-wrap gap-2">
                {pinnedVendors.slice(0, 4).map((v) => (
                  <Button
                    key={v.id}
                    variant="outline"
                    size="sm"
                    className="h-auto py-1 px-2"
                    onClick={() => handleSelectVendor(v)}
                  >
                    <Star className="h-3 w-3 mr-1 text-yellow-500 fill-yellow-500" />
                    {v.company || v.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          {!vendor && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, or specialty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {loading && search && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && !vendor && (
            <div className="border rounded-md divide-y">
              {searchResults.map((v) => (
                <button
                  key={v.id}
                  className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectVendor(v)}
                >
                  <p className="font-medium">{v.company || v.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {v.specialties.map(s => VENDOR_SPECIALTY_LABELS[s]).join(", ")}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Dropdowns for property + specialty lookup */}
          {!vendor && !search && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm text-muted-foreground">Or find by property & service:</p>
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
            </div>
          )}

          {/* Vendor Card */}
          {vendor && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold">{vendor.company || vendor.name}</h4>
                  {vendor.company && vendor.name && (
                    <p className="text-muted-foreground">{vendor.name}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {vendor.specialties.map(s => (
                      <Badge key={s} variant="outline">
                        {VENDOR_SPECIALTY_LABELS[s]}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {vendor.phone && (
                  <Button size="lg" className="flex-1" asChild>
                    <a href={`tel:${vendor.phone}`}>
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </a>
                  </Button>
                )}
                {vendor.email && (
                  <Button size="lg" variant="outline" className="flex-1" asChild>
                    <a href={`mailto:${vendor.email}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </a>
                  </Button>
                )}
              </div>

              {vendor.emergency_phone && (
                <p className="text-sm text-muted-foreground">
                  Emergency: <a href={`tel:${vendor.emergency_phone}`} className="hover:underline">{vendor.emergency_phone}</a>
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="w-full"
              >
                Search for another vendor
              </Button>
            </div>
          )}

          {/* No results */}
          {!loading && !vendor && selectedProperty && selectedSpecialty && (
            <p className="text-center text-muted-foreground py-4">
              No vendor found for this property and service type.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
