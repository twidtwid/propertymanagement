"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { BillFormDialog } from "./bill-form-dialog"
import type { Property, Vehicle } from "@/types/database"

interface AddBillButtonProps {
  properties: Property[]
  vehicles: Vehicle[]
}

export function AddBillButton({ properties, vehicles }: AddBillButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5 mr-2" />
        Add Bill
      </Button>
      <BillFormDialog
        open={open}
        onOpenChange={setOpen}
        properties={properties}
        vehicles={vehicles}
      />
    </>
  )
}
