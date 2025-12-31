import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { PolicyForm } from "@/components/insurance/policy-form"
import { getActiveProperties, getActiveVehicles } from "@/lib/actions"

export default async function NewPolicyPage() {
  const [properties, vehicles] = await Promise.all([
    getActiveProperties(),
    getActiveVehicles(),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/insurance">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Add Insurance Policy</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Add a new insurance policy
          </p>
        </div>
      </div>

      <PolicyForm properties={properties} vehicles={vehicles} />
    </div>
  )
}
