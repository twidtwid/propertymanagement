export const dynamic = 'force-dynamic'

import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { PolicyForm } from "@/components/insurance/policy-form"
import { getInsurancePolicy, getActiveProperties, getActiveVehicles } from "@/lib/actions"

export default async function EditPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [policy, properties, vehicles] = await Promise.all([
    getInsurancePolicy(id),
    getActiveProperties(),
    getActiveVehicles(),
  ])

  if (!policy) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/insurance/${policy.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit Policy</h1>
          <p className="text-lg text-muted-foreground mt-1">
            {policy.carrier_name} - {policy.policy_number || "No policy number"}
          </p>
        </div>
      </div>

      <PolicyForm policy={policy} properties={properties} vehicles={vehicles} />
    </div>
  )
}
