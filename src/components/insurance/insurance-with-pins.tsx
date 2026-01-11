"use client"

import React, { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Shield, AlertTriangle, FileText, Building2, Car, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { PinButton } from "@/components/ui/pin-button"
import { PinNoteButton } from "@/components/ui/pin-note-button"
import { PinNotes } from "@/components/ui/pin-notes"
import { PinnedSection } from "@/components/ui/pinned-section"
import { InsuranceFilters } from "./insurance-filters"
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils"
import type { InsurancePolicy, PinNote } from "@/types/database"
import { INSURANCE_TYPE_LABELS, INSURANCE_TYPE_SHORT_LABELS } from "@/types/database"

interface InsuranceWithPinsProps {
  policies: InsurancePolicy[]
  expiring: InsurancePolicy[]
  initialSmartPins: string[]
  initialUserPins: string[]
  initialNotesMap: Record<string, PinNote[]>
  initialUserNotesMap: Record<string, PinNote>
  carriers: string[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

function SortableHeader({
  column,
  label,
  currentSort,
  currentOrder,
  className,
}: {
  column: string
  label: string
  currentSort?: string
  currentOrder?: 'asc' | 'desc'
  className?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSort = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    if (currentSort === column) {
      params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sortBy', column)
      params.set('sortOrder', 'asc')
    }
    router.push(`/insurance?${params.toString()}`)
  }, [column, currentSort, currentOrder, router, searchParams])

  const isActive = currentSort === column
  const Icon = isActive
    ? currentOrder === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <TableHead className={className}>
      <button
        onClick={handleSort}
        className="flex items-center gap-1 hover:text-foreground transition-colors group"
      >
        {label}
        <Icon className={`h-4 w-4 ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
      </button>
    </TableHead>
  )
}

export function InsuranceWithPins({
  policies,
  expiring,
  initialSmartPins,
  initialUserPins,
  initialNotesMap,
  initialUserNotesMap,
  carriers,
  sortBy,
  sortOrder,
}: InsuranceWithPinsProps) {
  // Initialize state from server data
  const [smartPins, setSmartPins] = useState<Set<string>>(new Set(initialSmartPins))
  const [userPins, setUserPins] = useState<Set<string>>(new Set(initialUserPins))
  const [notesMap, setNotesMap] = useState<Record<string, PinNote[]>>(initialNotesMap)
  const [userNotesMap, setUserNotesMap] = useState<Record<string, PinNote>>(initialUserNotesMap)
  const [refreshKey, setRefreshKey] = useState(0)

  const allPinnedIds = new Set([...Array.from(smartPins), ...Array.from(userPins)])

  // Refresh notes for a specific entity
  const refreshNotes = async (entityId: string) => {
    try {
      const response = await fetch(`/api/pin-notes?entityType=insurance_policy&entityId=${entityId}`)
      if (response.ok) {
        const data = await response.json()
        setNotesMap((prev) => ({
          ...prev,
          [entityId]: data.notes || [],
        }))
        setUserNotesMap((prev) => ({
          ...prev,
          [entityId]: data.userNote || null,
        }))
        setRefreshKey((k) => k + 1)
      }
    } catch (error) {
      console.error("Failed to refresh notes:", error)
    }
  }

  // Optimistic update handler
  const handleTogglePin = (policyId: string, isPinned: boolean) => {
    if (isPinned) {
      // Adding a pin - always goes to user pins
      setUserPins((prev) => new Set(prev).add(policyId))
    } else {
      // Removing a pin - could be from either smart or user pins
      setSmartPins((prev) => {
        const next = new Set(prev)
        next.delete(policyId)
        return next
      })
      setUserPins((prev) => {
        const next = new Set(prev)
        next.delete(policyId)
        return next
      })
    }
  }

  // Create metadata for pin
  const createPinMetadata = (policy: InsurancePolicy) => ({
    title: `${policy.carrier_name} - ${INSURANCE_TYPE_LABELS[policy.policy_type]}`,
    carrier: policy.carrier_name,
    type: policy.policy_type,
    expirationDate: policy.expiration_date,
    premium: policy.premium_amount ? Number(policy.premium_amount) : undefined,
  })

  // Separate policies into pinned/unpinned
  const smartPinPolicies = policies.filter((p) => smartPins.has(p.id))
  const userPinPolicies = policies.filter((p) => !smartPins.has(p.id) && userPins.has(p.id))
  const unpinnedPolicies = policies.filter((p) => !allPinnedIds.has(p.id))

  // Separate unpinned policies by type
  const propertyPolicies = unpinnedPolicies.filter((p) => p.property_id)
  const vehiclePolicies = unpinnedPolicies.filter((p) => p.vehicle_id)
  const otherPolicies = unpinnedPolicies.filter((p) => !p.property_id && !p.vehicle_id)

  // Render a policy row
  const renderPolicyRow = (policy: InsurancePolicy, showProperty = true, showVehicle = true, showType = true) => {
    const days = policy.expiration_date ? daysUntil(policy.expiration_date) : null
    return (
      <TableRow key={policy.id}>
        {/* Pin button - LEFTMOST */}
        <TableCell className="w-10">
          <PinButton
            entityType="insurance_policy"
            entityId={policy.id}
            isPinned={allPinnedIds.has(policy.id)}
            pinType={smartPins.has(policy.id) ? "smart" : "user"}
            onToggle={(isPinned) => handleTogglePin(policy.id, isPinned)}
            metadata={createPinMetadata(policy)}
            size="sm"
            variant="ghost"
          />
        </TableCell>

        {showProperty && (
          <TableCell>
            <Link href={`/insurance/${policy.id}`} className="font-medium hover:underline">
              {policy.property?.name}
            </Link>
          </TableCell>
        )}

        {showVehicle && (
          <TableCell>
            <Link href={`/insurance/${policy.id}`} className="font-medium hover:underline">
              {policy.vehicle
                ? `${policy.vehicle.year} ${policy.vehicle.make} ${policy.vehicle.model}`
                : "-"}
            </Link>
          </TableCell>
        )}

        <TableCell>
          <Link href={`/insurance/${policy.id}`} className="block hover:underline">
            <p>{policy.carrier_name}</p>
            {policy.policy_number && (
              <p className="text-sm text-muted-foreground font-mono">
                {policy.policy_number}
              </p>
            )}
          </Link>
        </TableCell>

        {showType && (
          <TableCell>
            <Badge variant="outline">
              <span className="sm:hidden">{INSURANCE_TYPE_SHORT_LABELS[policy.policy_type]}</span>
              <span className="hidden sm:inline">{INSURANCE_TYPE_LABELS[policy.policy_type]}</span>
            </Badge>
          </TableCell>
        )}

        <TableCell>
          {policy.premium_amount ? (
            <div>
              <p className="font-medium">
                {formatCurrency(Number(policy.premium_amount))}
              </p>
              <p className="text-sm text-muted-foreground">
                /{policy.premium_frequency}
              </p>
            </div>
          ) : (
            "-"
          )}
        </TableCell>

        <TableCell suppressHydrationWarning>
          {policy.expiration_date ? formatDate(policy.expiration_date) : "-"}
        </TableCell>

        <TableCell>
          {days !== null && days <= 60 ? (
            <Badge variant={days <= 14 ? "destructive" : "warning"}>
              {days <= 0 ? "Expired" : `${days}d left`}
            </Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Insurance</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Manage your {policies.length} insurance policies
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/insurance/new">
            <Plus className="h-5 w-5 mr-2" />
            Add Policy
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <InsuranceFilters carriers={carriers} />
      </Card>

      {/* Smart Pins Section */}
      {smartPinPolicies.length > 0 && (
        <PinnedSection count={smartPinPolicies.length} title="Smart Pins" variant="smart">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {smartPinPolicies.map((policy) => {
                const days = policy.expiration_date ? daysUntil(policy.expiration_date) : null
                const policyNotes = notesMap[policy.id] || []
                const userNote = userNotesMap[policy.id]
                return (
                  <React.Fragment key={policy.id}>
                    <TableRow>
                      <TableCell className="w-10">
                        <PinButton
                          entityType="insurance_policy"
                          entityId={policy.id}
                          isPinned={true}
                          pinType="smart"
                          onToggle={(isPinned) => handleTogglePin(policy.id, isPinned)}
                          metadata={createPinMetadata(policy)}
                          size="sm"
                          variant="ghost"
                        />
                      </TableCell>
                      <TableCell className="w-10">
                        <PinNoteButton
                          entityType="insurance_policy"
                          entityId={policy.id}
                          existingNote={userNote}
                          onNoteSaved={() => refreshNotes(policy.id)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/insurance/${policy.id}`} className="font-medium hover:underline">
                          {policy.property?.name ||
                            (policy.vehicle
                              ? `${policy.vehicle.year} ${policy.vehicle.make} ${policy.vehicle.model}`
                              : "General")}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/insurance/${policy.id}`} className="block hover:underline">
                          <p>{policy.carrier_name}</p>
                          {policy.policy_number && (
                            <p className="text-sm text-muted-foreground font-mono">
                              {policy.policy_number}
                            </p>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <span className="sm:hidden">{INSURANCE_TYPE_SHORT_LABELS[policy.policy_type]}</span>
                          <span className="hidden sm:inline">{INSURANCE_TYPE_LABELS[policy.policy_type]}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {policy.premium_amount ? (
                          <div>
                            <p className="font-medium">
                              {formatCurrency(Number(policy.premium_amount))}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              /{policy.premium_frequency}
                            </p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell suppressHydrationWarning>
                        {policy.expiration_date ? formatDate(policy.expiration_date) : "-"}
                      </TableCell>
                      <TableCell>
                        {days !== null && days <= 60 ? (
                          <Badge variant={days <= 14 ? "destructive" : "warning"}>
                            {days <= 0 ? "Expired" : `${days}d left`}
                          </Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    {policyNotes.length > 0 && (
                      <TableRow key={`${policy.id}-notes`}>
                        <TableCell colSpan={8} className="py-0 pb-3">
                          <PinNotes
                            notes={policyNotes}
                            onNoteDeleted={() => refreshNotes(policy.id)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </PinnedSection>
      )}

      {/* User Pins Section */}
      {userPinPolicies.length > 0 && (
        <PinnedSection count={userPinPolicies.length} title="User Pins" variant="user">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userPinPolicies.map((policy) => {
                const days = policy.expiration_date ? daysUntil(policy.expiration_date) : null
                const policyNotes = notesMap[policy.id] || []
                const userNote = userNotesMap[policy.id]
                return (
                  <React.Fragment key={policy.id}>
                    <TableRow>
                      <TableCell className="w-10">
                        <PinButton
                          entityType="insurance_policy"
                          entityId={policy.id}
                          isPinned={true}
                          pinType="user"
                          onToggle={(isPinned) => handleTogglePin(policy.id, isPinned)}
                          metadata={createPinMetadata(policy)}
                          size="sm"
                          variant="ghost"
                        />
                      </TableCell>
                      <TableCell className="w-10">
                        <PinNoteButton
                          entityType="insurance_policy"
                          entityId={policy.id}
                          existingNote={userNote}
                          onNoteSaved={() => refreshNotes(policy.id)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/insurance/${policy.id}`} className="font-medium hover:underline">
                          {policy.property?.name ||
                            (policy.vehicle
                              ? `${policy.vehicle.year} ${policy.vehicle.make} ${policy.vehicle.model}`
                              : "General")}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/insurance/${policy.id}`} className="block hover:underline">
                          <p>{policy.carrier_name}</p>
                          {policy.policy_number && (
                            <p className="text-sm text-muted-foreground font-mono">
                              {policy.policy_number}
                            </p>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <span className="sm:hidden">{INSURANCE_TYPE_SHORT_LABELS[policy.policy_type]}</span>
                          <span className="hidden sm:inline">{INSURANCE_TYPE_LABELS[policy.policy_type]}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {policy.premium_amount ? (
                          <div>
                            <p className="font-medium">
                              {formatCurrency(Number(policy.premium_amount))}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              /{policy.premium_frequency}
                            </p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell suppressHydrationWarning>
                        {policy.expiration_date ? formatDate(policy.expiration_date) : "-"}
                      </TableCell>
                      <TableCell>
                        {days !== null && days <= 60 ? (
                          <Badge variant={days <= 14 ? "destructive" : "warning"}>
                            {days <= 0 ? "Expired" : `${days}d left`}
                          </Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    {policyNotes.length > 0 && (
                      <TableRow key={`${policy.id}-notes`}>
                        <TableCell colSpan={8} className="py-0 pb-3">
                          <PinNotes
                            notes={policyNotes}
                            onNoteDeleted={() => refreshNotes(policy.id)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </PinnedSection>
      )}

      {/* Expiring Policies Alert */}
      {expiring.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Policies Expiring Soon ({expiring.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expiring.map((policy) => {
                const days = daysUntil(policy.expiration_date!)
                return (
                  <Link
                    key={policy.id}
                    href={`/insurance/${policy.id}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-white hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {policy.property_id ? (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Car className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-base font-medium">
                          {policy.carrier_name} - {INSURANCE_TYPE_LABELS[policy.policy_type]}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {policy.property?.name ||
                            (policy.vehicle
                              ? `${policy.vehicle.year} ${policy.vehicle.make} ${policy.vehicle.model}`
                              : "General")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Expires {formatDate(policy.expiration_date!)}
                        </p>
                        <Badge variant={days <= 14 ? "destructive" : "warning"}>
                          {days <= 0 ? "Expired" : `${days} days left`}
                        </Badge>
                      </div>
                      {policy.auto_renew && <Badge variant="outline">Auto-renew</Badge>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content - Unpinned Policies */}
      <Tabs defaultValue="property" className="space-y-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto flex-nowrap">
          <TabsTrigger value="property" className="gap-2 flex-shrink-0">
            <Building2 className="h-4 w-4" />
            Property ({propertyPolicies.length})
          </TabsTrigger>
          <TabsTrigger value="auto" className="gap-2 flex-shrink-0">
            <Car className="h-4 w-4" />
            Auto ({vehiclePolicies.length})
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-2 flex-shrink-0">
            <Shield className="h-4 w-4" />
            Other ({otherPolicies.length})
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2 flex-shrink-0">
            <FileText className="h-4 w-4" />
            Claims
          </TabsTrigger>
        </TabsList>

        <TabsContent value="property">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <SortableHeader column="asset_name" label="Property" currentSort={sortBy} currentOrder={sortOrder} />
                    <SortableHeader column="carrier_name" label="Carrier" currentSort={sortBy} currentOrder={sortOrder} />
                    <SortableHeader column="policy_type" label="Type" currentSort={sortBy} currentOrder={sortOrder} />
                    <SortableHeader column="premium_amount" label="Premium" currentSort={sortBy} currentOrder={sortOrder} />
                    <SortableHeader column="expiration_date" label="Expiration" currentSort={sortBy} currentOrder={sortOrder} />
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertyPolicies.map((policy) => renderPolicyRow(policy, true, false, true))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <SortableHeader column="asset_name" label="Vehicle" currentSort={sortBy} currentOrder={sortOrder} />
                    <SortableHeader column="carrier_name" label="Carrier" currentSort={sortBy} currentOrder={sortOrder} />
                    <SortableHeader column="premium_amount" label="Premium" currentSort={sortBy} currentOrder={sortOrder} />
                    <SortableHeader column="expiration_date" label="Expiration" currentSort={sortBy} currentOrder={sortOrder} />
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehiclePolicies.map((policy) => renderPolicyRow(policy, false, true, false))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other">
          <Card>
            <CardContent className="pt-6">
              {otherPolicies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No other policies</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <SortableHeader column="carrier_name" label="Carrier" currentSort={sortBy} currentOrder={sortOrder} />
                      <SortableHeader column="policy_type" label="Type" currentSort={sortBy} currentOrder={sortOrder} />
                      <SortableHeader column="premium_amount" label="Premium" currentSort={sortBy} currentOrder={sortOrder} />
                      <SortableHeader column="expiration_date" label="Expiration" currentSort={sortBy} currentOrder={sortOrder} />
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherPolicies.map((policy) => renderPolicyRow(policy, false, false, true))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Insurance Claims</CardTitle>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Claim
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">No claims on file</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
