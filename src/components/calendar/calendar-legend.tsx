"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Info } from "lucide-react"

const legendItems = [
  { color: "bg-blue-500", label: "Bills" },
  { color: "bg-purple-500", label: "Property Taxes" },
  { color: "bg-orange-500", label: "Insurance" },
  { color: "bg-cyan-500", label: "Vehicle Registration" },
  { color: "bg-teal-500", label: "Vehicle Inspection" },
  { color: "bg-amber-500", label: "Maintenance" },
]

export function CalendarLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">Legend</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48" align="end">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Event Types</h4>
          <div className="space-y-1.5">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm ring-2 ring-red-400 bg-gray-200" />
              <span className="text-sm text-muted-foreground">Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm ring-1 ring-orange-300 bg-gray-200" />
              <span className="text-sm text-muted-foreground">Urgent</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
