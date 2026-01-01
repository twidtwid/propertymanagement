"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { markBillPaid } from "@/lib/mutations"

interface MarkPaidButtonProps {
  billId: string
  source: string
}

const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "auto_pay", label: "Auto Pay" },
  { value: "online", label: "Online" },
  { value: "wire", label: "Wire Transfer" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

export function MarkPaidButton({ billId, source }: MarkPaidButtonProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const { toast } = useToast()

  // Only support bills for now (not property_tax or insurance_premium)
  if (source !== "bill") {
    return null
  }

  const handleSubmit = async () => {
    if (!paymentDate) {
      toast({
        title: "Error",
        description: "Please enter a payment date",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    const result = await markBillPaid(
      billId,
      paymentDate,
      paymentMethod || undefined
    )
    setIsLoading(false)

    if (result.success) {
      toast({
        title: "Marked as paid",
        description: "The bill has been marked as sent/paid. It will need confirmation once cleared.",
      })
      setOpen(false)
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CreditCard className="h-4 w-4 mr-1" />
          Mark Paid
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Mark Payment as Sent</DialogTitle>
          <DialogDescription>
            Enter the payment date and method. The payment will be marked as
            &quot;sent&quot; and will need confirmation once cleared.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="paymentMethod">
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Mark Paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
