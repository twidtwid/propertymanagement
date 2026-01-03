import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { getVendorsFiltered, getVendorLocations, getProperties, getSmartAndUserPins } from "@/lib/actions"
import { getUser } from "@/lib/auth"
import { VendorFilters } from "@/components/vendors/vendor-filters"
import { VendorList } from "@/components/vendors/vendor-list"
import { QuickContact } from "@/components/dashboard/quick-contact"

interface VendorsPageProps {
  searchParams: Promise<{
    specialty?: string
    location?: string
    search?: string
  }>
}

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  const params = await searchParams
  const user = await getUser()

  const [vendors, locations, properties, pins] = await Promise.all([
    getVendorsFiltered({
      specialty: params.specialty,
      location: params.location,
      search: params.search,
    }),
    getVendorLocations(),
    getProperties(),
    getSmartAndUserPins('vendor'),
  ])

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

      <div className="max-w-md">
        <QuickContact properties={properties} />
      </div>

      <Card className="p-4">
        <VendorFilters locations={locations} />
      </Card>

      <VendorList vendors={vendors} userPins={Array.from(pins.userPins)} />
    </div>
  )
}
