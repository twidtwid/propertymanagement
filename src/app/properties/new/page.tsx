import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { PropertyForm } from "@/components/properties/property-form"

export default function NewPropertyPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/properties">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Add Property</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Enter the details for your new property
          </p>
        </div>
      </div>

      <PropertyForm />
    </div>
  )
}
