"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateTicketStatus } from "@/lib/mutations"
import { useToast } from "@/hooks/use-toast"

interface TicketStatusButtonProps {
  ticketId: string
  newStatus: "pending" | "in_progress"
  children: React.ReactNode
}

export function TicketStatusButton({ ticketId, newStatus, children }: TicketStatusButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  const handleClick = () => {
    startTransition(async () => {
      const result = await updateTicketStatus(ticketId, newStatus)

      if (result.success) {
        const statusLabel = newStatus === "in_progress" ? "In Progress" : "Open"
        toast({
          title: "Status updated",
          description: `Ticket is now ${statusLabel}.`,
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update status",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div onClick={handleClick} className={isPending ? "opacity-50 pointer-events-none" : ""}>
      {children}
    </div>
  )
}
