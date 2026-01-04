import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPropertyTax, getActiveProperties } from "@/lib/actions"
import { TaxForm } from "@/components/payments/tax-form"

export default async function EditTaxPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [tax, properties] = await Promise.all([
    getPropertyTax(id),
    getActiveProperties(),
  ])

  if (!tax) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Property Tax</h1>
        <p className="text-muted-foreground mt-1">
          {tax.property_name} - {tax.jurisdiction} Q{tax.installment} {tax.tax_year}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <TaxForm properties={properties} tax={tax} />
        </CardContent>
      </Card>
    </div>
  )
}
