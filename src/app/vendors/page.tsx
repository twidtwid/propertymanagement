import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Phone, Mail, Star, MapPin } from "lucide-react"
import { getVendorsFiltered, getVendorLocations } from "@/lib/actions"
import { VENDOR_SPECIALTY_LABELS } from "@/types/database"
import { VendorFilters } from "@/components/vendors/vendor-filters"

interface VendorsPageProps {
  searchParams: Promise<{
    specialty?: string
    location?: string
    search?: string
  }>
}

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  const params = await searchParams
  const [vendors, locations] = await Promise.all([
    getVendorsFiltered({
      specialty: params.specialty,
      location: params.location,
      search: params.search,
    }),
    getVendorLocations(),
  ])

  // Group vendors by specialty for the grid view
  const vendorsBySpecialty = vendors.reduce((acc, vendor) => {
    const specialty = vendor.specialty
    if (!acc[specialty]) acc[specialty] = []
    acc[specialty].push(vendor)
    return acc
  }, {} as Record<string, typeof vendors>)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Your vendor directory - {vendors.length} contacts
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/vendors/new">
            <Plus className="h-5 w-5 mr-2" />
            Add Vendor
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <VendorFilters locations={locations} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/vendors/${vendor.id}`} className="block">
                      <p className="font-medium text-base">{vendor.name}</p>
                      {vendor.company && (
                        <p className="text-sm text-muted-foreground">
                          {vendor.company}
                        </p>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {VENDOR_SPECIALTY_LABELS[vendor.specialty]}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
                          <a
                            href={`tel:${vendor.phone}`}
                            className="hover:underline"
                          >
                            {vendor.phone}
                          </a>
                        </div>
                      )}
                      {vendor.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`mailto:${vendor.email}`}
                            className="hover:underline"
                          >
                            {vendor.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {vendor.rating ? (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < vendor.rating!
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not rated
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={vendor.is_active ? "success" : "secondary"}
                    >
                      {vendor.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {vendors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No vendors found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">By Specialty</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(vendorsBySpecialty)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([specialty, specialtyVendors]) => (
              <Card key={specialty}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {VENDOR_SPECIALTY_LABELS[specialty as keyof typeof VENDOR_SPECIALTY_LABELS]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {specialtyVendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Link href={`/vendors/${vendor.id}`} className="flex-1">
                          <span className="text-base">{vendor.name}</span>
                          {vendor.locations.length > 0 && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({vendor.locations.join(", ")})
                            </span>
                          )}
                        </Link>
                        {vendor.phone && (
                          <a
                            href={`tel:${vendor.phone}`}
                            className="p-2 hover:bg-muted rounded-md"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  )
}
