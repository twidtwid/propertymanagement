"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { Property, Vendor } from "@/types/database"

interface TicketFiltersProps {
  properties: Property[]
  vendors: Vendor[]
}

export function TicketFilters({ properties, vendors }: TicketFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const propertyId = searchParams.get("property") || "all"
  const vendorId = searchParams.get("vendor") || "all"
  const search = searchParams.get("search") || ""
  const showClosed = searchParams.get("showClosed") === "true"

  const updateFilter = useCallback(
    (key: string, value: string | boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === "all" || value === "" || value === false) {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
      router.push(`/tickets?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.push("/tickets")
  }, [router])

  const hasFilters = propertyId !== "all" || vendorId !== "all" || search || showClosed

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={propertyId} onValueChange={(v) => updateFilter("property", v)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Properties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Properties</SelectItem>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={vendorId} onValueChange={(v) => updateFilter("vendor", v)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Vendors" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Vendors</SelectItem>
          {vendors.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.company || v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Search tickets..."
        value={search}
        onChange={(e) => updateFilter("search", e.target.value)}
        className="w-[200px]"
      />

      <div className="flex items-center space-x-2">
        <Checkbox
          id="showClosed"
          checked={showClosed}
          onCheckedChange={(checked) => updateFilter("showClosed", checked as boolean)}
        />
        <Label htmlFor="showClosed" className="text-sm text-muted-foreground cursor-pointer">
          Show Closed
        </Label>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
