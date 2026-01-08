"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { VENDOR_SPECIALTY_LABELS } from "@/types/database"
import type { Vendor } from "@/types/database"

interface VendorComboboxProps {
  vendors: Vendor[]
  value: string | null | undefined
  onValueChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
}

export function VendorCombobox({
  vendors,
  value,
  onValueChange,
  placeholder = "Select vendor...",
  disabled = false,
}: VendorComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedVendor = vendors.find((v) => v.id === value)
  const displayName = selectedVendor
    ? selectedVendor.company || selectedVendor.name
    : null

  // Sort and filter vendors
  const filteredVendors = React.useMemo(() => {
    const sorted = [...vendors].sort((a, b) =>
      (a.company || a.name).localeCompare(b.company || b.name)
    )

    if (!search.trim()) return sorted

    const searchLower = search.toLowerCase()
    return sorted.filter((v) => {
      const name = (v.company || v.name).toLowerCase()
      const personName = v.name.toLowerCase()
      const specialties = v.specialties
        .map((s) => VENDOR_SPECIALTY_LABELS[s]?.toLowerCase() || s)
        .join(" ")
      return (
        name.includes(searchLower) ||
        personName.includes(searchLower) ||
        specialties.includes(searchLower)
      )
    })
  }, [vendors, search])

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearch("")
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {displayName || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSearch("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-1">
            {/* Unassigned option */}
            <button
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                !value && "bg-accent"
              )}
              onClick={() => {
                onValueChange(null)
                setOpen(false)
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  !value ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="text-muted-foreground">Unassigned</span>
            </button>

            {filteredVendors.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No vendors found
              </div>
            ) : (
              filteredVendors.map((vendor) => (
                <button
                  key={vendor.id}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === vendor.id && "bg-accent"
                  )}
                  onClick={() => {
                    onValueChange(vendor.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === vendor.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                    <span className="truncate font-medium">
                      {vendor.company || vendor.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {vendor.company && vendor.name !== vendor.company && (
                        <span className="text-xs text-muted-foreground truncate">
                          {vendor.name}
                        </span>
                      )}
                      {vendor.specialties.slice(0, 1).map((s) => (
                        <Badge key={s} variant="outline" className="text-xs py-0 h-4">
                          {VENDOR_SPECIALTY_LABELS[s] || s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
