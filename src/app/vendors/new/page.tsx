import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { VendorForm } from "@/components/vendors/vendor-form"

export default function NewVendorPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/vendors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Add Vendor</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Add a new vendor to your directory
          </p>
        </div>
      </div>

      <VendorForm />
    </div>
  )
}
