"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TaxFormDialog } from "./tax-form-dialog"
import type { Property } from "@/types/database"

interface AddTaxButtonProps {
  properties: Property[]
}

export function AddTaxButton({ properties }: AddTaxButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5 mr-2" />
        Add Tax
      </Button>
      <TaxFormDialog
        open={open}
        onOpenChange={setOpen}
        properties={properties}
      />
    </>
  )
}
