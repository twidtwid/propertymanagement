import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { getProperty } from "@/lib/actions"
import { PropertyForm } from "@/components/properties/property-form"

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const property = await getProperty(id)

  if (!property) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/properties/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Edit Property
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Update {property.name}
          </p>
        </div>
      </div>

      <PropertyForm property={property} />
    </div>
  )
}
