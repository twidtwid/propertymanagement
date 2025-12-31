import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Globe,
  MapPin,
  Star,
  AlertCircle,
  FileText,
  Building,
  MessageSquare,
  User,
} from "lucide-react"
import { getVendor, getVendorCommunications } from "@/lib/actions"
import { VENDOR_SPECIALTY_LABELS } from "@/types/database"
import { VendorJournal } from "@/components/vendors/vendor-journal"

export default async function VendorDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const vendor = await getVendor(params.id)

  if (!vendor) {
    notFound()
  }

  const communications = await getVendorCommunications(params.id)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/vendors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {vendor.name}
            </h1>
            <Badge variant={vendor.is_active ? "success" : "secondary"}>
              {vendor.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {vendor.company && (
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <Building className="h-4 w-4" />
              <p className="text-lg">{vendor.company}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {vendor.phone && (
            <Button size="lg" asChild>
              <a href={`tel:${vendor.phone}`}>
                <Phone className="h-5 w-5 mr-2" />
                Call
              </a>
            </Button>
          )}
          <Button size="lg" variant="outline">
            <Edit className="h-5 w-5 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <User className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="journal" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Journal ({communications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendor.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <a
                      href={`tel:${vendor.phone}`}
                      className="text-base font-medium hover:underline"
                    >
                      {vendor.phone}
                    </a>
                  </div>
                )}
                {vendor.emergency_phone && (
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <a
                        href={`tel:${vendor.emergency_phone}`}
                        className="text-base font-medium hover:underline"
                      >
                        {vendor.emergency_phone}
                      </a>
                      <p className="text-sm text-muted-foreground">Emergency</p>
                    </div>
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <a
                      href={`mailto:${vendor.email}`}
                      className="text-base font-medium hover:underline"
                    >
                      {vendor.email}
                    </a>
                  </div>
                )}
                {vendor.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <a
                      href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-medium hover:underline"
                    >
                      {vendor.website}
                    </a>
                  </div>
                )}
                {vendor.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <p className="text-base">{vendor.address}</p>
                  </div>
                )}
                {!vendor.phone && !vendor.email && !vendor.address && (
                  <p className="text-muted-foreground">No contact info on file</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Specialty</p>
                  <Badge variant="outline" className="mt-1">
                    {VENDOR_SPECIALTY_LABELS[vendor.specialty]}
                  </Badge>
                </div>
                {vendor.rating && (
                  <div>
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < vendor.rating!
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {vendor.payment_method && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="text-base font-medium capitalize">
                      {vendor.payment_method.replace("_", " ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendor.account_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="text-base font-medium font-mono">
                      {vendor.account_number}
                    </p>
                  </div>
                )}
                {vendor.login_info && (
                  <div>
                    <p className="text-sm text-muted-foreground">Login Info</p>
                    <p className="text-base font-medium font-mono">
                      {vendor.login_info}
                    </p>
                  </div>
                )}
                {!vendor.account_number && !vendor.login_info && (
                  <p className="text-muted-foreground">No account info on file</p>
                )}
              </CardContent>
            </Card>
          </div>

          {vendor.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base whitespace-pre-wrap">{vendor.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="journal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Email Communications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VendorJournal communications={communications} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
