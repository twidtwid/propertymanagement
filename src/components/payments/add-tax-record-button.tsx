"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TaxFormDialog } from "./tax-form-dialog"
import type { Property } from "@/types/database"

interface AddTaxRecordButtonProps {
  property: Property
}

export function AddTaxRecordButton({ property }: AddTaxRecordButtonProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        Add Tax Record
      </Button>
      <TaxFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        properties={[property]}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
