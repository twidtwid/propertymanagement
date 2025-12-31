import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { getVendor, getProperties, getPropertiesForVendor } from "@/lib/actions"
import { VendorForm } from "@/components/vendors/vendor-form"

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [vendor, properties, assignedProperties] = await Promise.all([
    getVendor(id),
    getProperties(),
    getPropertiesForVendor(id),
  ])

  if (!vendor) {
    notFound()
  }

  const assignedPropertyIds = assignedProperties.map(p => p.id)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/vendors/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Edit Vendor
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Update {vendor.name}&apos;s information
          </p>
        </div>
      </div>

      <VendorForm
        vendor={vendor}
        properties={properties}
        assignedPropertyIds={assignedPropertyIds}
      />
    </div>
  )
}
