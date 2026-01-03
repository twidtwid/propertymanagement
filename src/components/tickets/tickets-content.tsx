"use client"

import { useState } from "react"
import { PinnedSection } from "@/components/ui/pinned-section"
import { PinNotes } from "@/components/ui/pin-notes"
import { TicketList, TicketRowSimple } from "./ticket-list"
import type { TicketWithDetails } from "@/lib/actions"
import type { PinNote } from "@/types/database"

interface TicketsContentProps {
  tickets: TicketWithDetails[]
  initialSmartPins: string[]
  initialUserPins: string[]
  initialNotesMap: Record<string, PinNote[]>
  initialUserNotesMap: Record<string, PinNote>
}

export function TicketsContent({ tickets, initialSmartPins, initialUserPins, initialNotesMap, initialUserNotesMap }: TicketsContentProps) {
  const [smartPins, setSmartPins] = useState<Set<string>>(new Set(initialSmartPins))
  const [userPins, setUserPins] = useState<Set<string>>(new Set(initialUserPins))
  const [notesMap, setNotesMap] = useState<Record<string, PinNote[]>>(initialNotesMap)
  const [userNotesMap, setUserNotesMap] = useState<Record<string, PinNote>>(initialUserNotesMap)

  const allPinnedIds = new Set([...Array.from(smartPins), ...Array.from(userPins)])

  // Refresh notes for a specific ticket
  const refreshNotes = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/pin-notes?entityType=ticket&entityId=${ticketId}`)
      if (response.ok) {
        const data = await response.json()
        setNotesMap((prev) => ({
          ...prev,
          [ticketId]: data.notes || [],
        }))
        setUserNotesMap((prev) => ({
          ...prev,
          [ticketId]: data.userNote || null,
        }))
      }
    } catch (error) {
      console.error("Failed to refresh notes:", error)
    }
  }

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
                userNote={userNotesMap[ticket.id]}
                onNoteSaved={() => refreshNotes(ticket.id)}
                notes={notesMap[ticket.id] || []}
                onNoteDeleted={() => refreshNotes(ticket.id)}
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
                userNote={userNotesMap[ticket.id]}
                onNoteSaved={() => refreshNotes(ticket.id)}
                notes={notesMap[ticket.id] || []}
                onNoteDeleted={() => refreshNotes(ticket.id)}
              />
            ))}
          </div>
        </PinnedSection>
      )}

      <TicketList tickets={unpinnedTickets} pinnedIds={allPinnedIds} onTogglePin={handleTogglePin} />
    </>
  )
}
