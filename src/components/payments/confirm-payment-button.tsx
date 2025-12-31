"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { confirmBillPayment } from "@/lib/mutations"

interface ConfirmPaymentButtonProps {
  billId: string
}

export function ConfirmPaymentButton({ billId }: ConfirmPaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleConfirm = async () => {
    setIsLoading(true)
    const result = await confirmBillPayment(billId)
    setIsLoading(false)

    if (result.success) {
      toast({
        title: "Payment confirmed",
        description: "The payment has been confirmed as cashed.",
      })
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  return (
    <Button size="sm" onClick={handleConfirm} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Check className="h-4 w-4 mr-1" />
      )}
      Confirm
    </Button>
  )
}
