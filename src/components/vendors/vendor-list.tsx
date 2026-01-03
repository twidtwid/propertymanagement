"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Phone, Mail, MapPin, Star } from "lucide-react"
import { VENDOR_SPECIALTY_LABELS } from "@/types/database"
import { StarVendorButton } from "./star-vendor-button"
import type { VendorWithLocations } from "@/lib/actions"

interface VendorListProps {
  vendors: VendorWithLocations[]
  starredIds: string[]
}

export function VendorList({ vendors, starredIds: initialStarredIds }: VendorListProps) {
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set(initialStarredIds))

  const handleToggleStar = (vendorId: string, isStarred: boolean) => {
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (isStarred) {
        next.add(vendorId)
      } else {
        next.delete(vendorId)
      }
      return next
    })
  }

  // Separate pinned and unpinned vendors
  const pinnedVendors = vendors.filter((v) => starredIds.has(v.id))
  const unpinnedVendors = vendors.filter((v) => !starredIds.has(v.id))

  const renderVendorRow = (vendor: VendorWithLocations) => (
    <TableRow key={vendor.id} className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <StarVendorButton
          vendorId={vendor.id}
          isStarred={starredIds.has(vendor.id)}
          onToggle={(isStarred) => handleToggleStar(vendor.id, isStarred)}
        />
      </TableCell>
      <TableCell>
        <Link href={`/vendors/${vendor.id}`} className="block">
          <p className="font-medium text-base">{vendor.company || vendor.name}</p>
          {vendor.company && vendor.name && (
            <p className="text-sm text-muted-foreground">{vendor.name}</p>
          )}
          {vendor.locations.length > 0 && (
            <p className="text-sm text-muted-foreground sm:hidden">
              {vendor.locations.join(", ")}
            </p>
          )}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{VENDOR_SPECIALTY_LABELS[vendor.specialty]}</Badge>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {vendor.locations.length > 0 ? (
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{vendor.locations.join(", ")}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          {vendor.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${vendor.phone}`} className="hover:underline">
                {vendor.phone}
              </a>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${vendor.email}`} className="hover:underline">
                {vendor.email}
              </a>
            </div>
          )}
          {!vendor.phone && !vendor.email && (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant={vendor.is_active ? "success" : "secondary"}>
          {vendor.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
    </TableRow>
  )

  return (
    <div className="space-y-6">
      {/* Pinned Vendors Section */}
      {pinnedVendors.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              Pinned Vendors
              <Badge variant="secondary" className="bg-yellow-200 text-yellow-800">
                {pinnedVendors.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableBody>
                {pinnedVendors.map(renderVendorRow)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Vendors Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead className="hidden sm:table-cell">Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unpinnedVendors.map(renderVendorRow)}
              {unpinnedVendors.length === 0 && pinnedVendors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No vendors found matching your filters.
                  </TableCell>
                </TableRow>
              )}
              {unpinnedVendors.length === 0 && pinnedVendors.length > 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    All matching vendors are pinned above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
