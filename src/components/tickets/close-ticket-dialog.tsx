"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { CheckCircle2 } from "lucide-react"
import { closeTicket } from "@/lib/mutations"
import { useToast } from "@/hooks/use-toast"

interface CloseTicketDialogProps {
  ticketId: string
  ticketTitle: string
  children?: React.ReactNode
}

export function CloseTicketDialog({ ticketId, ticketTitle, children }: CloseTicketDialogProps) {
  const [open, setOpen] = useState(false)
  const [resolution, setResolution] = useState("")
  const [actualCost, setActualCost] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!resolution.trim()) {
      toast({
        title: "Resolution required",
        description: "Please describe how the issue was resolved.",
        variant: "destructive",
      })
      return
    }

    startTransition(async () => {
      const result = await closeTicket(ticketId, {
        resolution: resolution.trim(),
        actual_cost: actualCost ? parseFloat(actualCost) : null,
      })

      if (result.success) {
        toast({
          title: "Ticket closed",
          description: `"${ticketTitle}" has been closed.`,
        })
        setOpen(false)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to close ticket",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Close Ticket
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Close Ticket</DialogTitle>
            <DialogDescription>
              Describe how the issue was resolved. This will be recorded in the ticket history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">
                Resolution <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="resolution"
                placeholder="How was this issue resolved?"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualCost">Final Cost (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="actualCost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Closing..." : "Close Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
