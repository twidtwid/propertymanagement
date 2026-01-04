"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Check, Loader2 } from "lucide-react"
import { markPropertyTaxPaid, confirmPropertyTaxPayment } from "@/lib/mutations"
import { useToast } from "@/hooks/use-toast"

const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "auto_pay", label: "Auto Pay" },
  { value: "online", label: "Online" },
  { value: "wire", label: "Wire Transfer" },
  { value: "other", label: "Other" },
]

export function MarkTaxPaidButton({ taxId }: { taxId: string }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const { toast } = useToast()
  const router = useRouter()

  const handleSubmit = async () => {
    if (!paymentDate) {
      toast({ title: "Error", description: "Please enter a payment date", variant: "destructive" })
      return
    }

    setIsLoading(true)
    const result = await markPropertyTaxPaid(taxId, paymentDate, paymentMethod || undefined)
    setIsLoading(false)

    if (result.success) {
      toast({ title: "Marked as paid", description: "The tax payment has been marked as sent." })
      setOpen(false)
      router.refresh()
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <CreditCard className="h-5 w-5 mr-2" />
          Mark Paid
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Mark Tax Payment as Sent</DialogTitle>
          <DialogDescription>
            Enter the payment date and method.
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
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
            Mark Paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmTaxButton({ taxId }: { taxId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleConfirm = async () => {
    setIsLoading(true)
    const result = await confirmPropertyTaxPayment(taxId)
    setIsLoading(false)

    if (result.success) {
      toast({ title: "Payment confirmed", description: "The tax payment has been confirmed." })
      router.refresh()
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  return (
    <Button size="lg" onClick={handleConfirm} disabled={isLoading}>
      {isLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Check className="h-5 w-5 mr-2" />}
      Confirm Payment
    </Button>
  )
}
