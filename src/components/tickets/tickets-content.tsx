"use client"

import { useState } from "react"
import { PinnedSection } from "@/components/ui/pinned-section"
import { TicketList, TicketRowSimple } from "./ticket-list"
import type { TicketWithDetails } from "@/lib/actions"

interface TicketsContentProps {
  tickets: TicketWithDetails[]
  initialSmartPins: string[]
  initialUserPins: string[]
}

export function TicketsContent({ tickets, initialSmartPins, initialUserPins }: TicketsContentProps) {
  const [smartPins, setSmartPins] = useState<Set<string>>(new Set(initialSmartPins))
  const [userPins, setUserPins] = useState<Set<string>>(new Set(initialUserPins))

  const allPinnedIds = new Set([...Array.from(smartPins), ...Array.from(userPins)])

  const handleTogglePin = (ticketId: string, isPinned: boolean) => {
    if (isPinned) {
      // Adding a pin - always goes to user pins
      setUserPins((prev) => new Set(prev).add(ticketId))
    } else {
      // Removing a pin - could be from either smart or user pins
      setSmartPins((prev) => {
        const next = new Set(prev)
        next.delete(ticketId)
        return next
      })
      setUserPins((prev) => {
        const next = new Set(prev)
        next.delete(ticketId)
        return next
      })
    }
  }

  // Separate into smart pins, user pins, and unpinned
  const smartPinTickets = tickets.filter(t => smartPins.has(t.id))
  const userPinTickets = tickets.filter(t => !smartPins.has(t.id) && userPins.has(t.id))
  const unpinnedTickets = tickets.filter(t => !allPinnedIds.has(t.id))

  return (
    <>
      {smartPinTickets.length > 0 && (
        <PinnedSection count={smartPinTickets.length} title="Smart Pins" variant="smart">
          <div className="space-y-2">
            {smartPinTickets.map((ticket) => (
              <TicketRowSimple
                key={ticket.id}
                ticket={ticket}
                pinnedIds={allPinnedIds}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </PinnedSection>
      )}

      {userPinTickets.length > 0 && (
        <PinnedSection count={userPinTickets.length} title="User Pins" variant="user">
          <div className="space-y-2">
            {userPinTickets.map((ticket) => (
              <TicketRowSimple
                key={ticket.id}
                ticket={ticket}
                pinnedIds={allPinnedIds}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </PinnedSection>
      )}

      <TicketList tickets={unpinnedTickets} pinnedIds={allPinnedIds} onTogglePin={handleTogglePin} />
    </>
  )
}
