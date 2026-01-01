export const dynamic = 'force-dynamic'

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Building2, MapPin, Home, Building, LandPlot } from "lucide-react"
import { getProperties } from "@/lib/actions"
import { PROPERTY_TYPE_LABELS } from "@/types/database"
import type { PropertyType } from "@/types/database"

const propertyIcons: Record<PropertyType, typeof Building2> = {
  house: Home,
  condo: Building,
  land: LandPlot,
  other: Building2,
}

export default async function PropertiesPage() {
  const properties = await getProperties()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Properties</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Manage your {properties.length} properties
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/properties/new">
            <Plus className="h-5 w-5 mr-2" />
            Add Property
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => {
          const Icon = propertyIcons[property.property_type]
          return (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge
                      variant={property.status === "active" ? "success" : "secondary"}
                    >
                      {property.status}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xl font-semibold">{property.name}</h3>
                    <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <p className="text-base">
                        {property.city}, {property.state || property.country}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {property.address}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {PROPERTY_TYPE_LABELS[property.property_type]}
                    </span>
                    {property.has_mortgage && (
                      <Badge variant="outline">Mortgage</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
