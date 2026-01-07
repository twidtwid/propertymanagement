"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Phone, Plus, CreditCard, Zap } from "lucide-react"
import { QuickContactModal } from "./quick-contact-modal"
import type { Property, Vendor } from "@/types/database"

interface QuickActionsBarProps {
  properties: Property[]
  pinnedVendors?: Vendor[]
}

export function QuickActionsBar({ properties, pinnedVendors = [] }: QuickActionsBarProps) {
  const [contactModalOpen, setContactModalOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setContactModalOpen(true)}
          >
            <Phone className="h-4 w-4 mr-2" />
            Find Contact
          </Button>

          <Button variant="outline" className="w-full justify-start" asChild>
            <Link href="/tickets/new">
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Link>
          </Button>

          <Button variant="outline" className="w-full justify-start" asChild>
            <Link href="/payments">
              <CreditCard className="h-4 w-4 mr-2" />
              View Payments
            </Link>
          </Button>
        </CardContent>
      </Card>

      <QuickContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        properties={properties}
        pinnedVendors={pinnedVendors}
      />
    </>
  )
}
