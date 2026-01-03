import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
  Home,
  ChevronDown,
  CreditCard,
} from "lucide-react"
import { getVendor, getVendorCommunications, getPropertiesForVendor, getStarredVendorIds } from "@/lib/actions"
import { getUser } from "@/lib/auth"
import { VENDOR_SPECIALTY_LABELS } from "@/types/database"
import { VendorJournal } from "@/components/vendors/vendor-journal"
import { VendorContactsList } from "@/components/vendors/vendor-contacts-list"
import { DeleteVendorButton } from "@/components/vendors/delete-vendor-button"
import { StarVendorButton } from "@/components/vendors/star-vendor-button"

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [vendor, user] = await Promise.all([
    getVendor(id),
    getUser(),
  ])

  if (!vendor) {
    notFound()
  }

  const [communications, assignedProperties, starredIds] = await Promise.all([
    getVendorCommunications(id),
    getPropertiesForVendor(id),
    user ? getStarredVendorIds(user.id) : Promise.resolve(new Set<string>()),
  ])

  const isStarred = starredIds.has(id)

  const hasAccountInfo = vendor.account_number || vendor.login_info || vendor.payment_method

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/vendors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <StarVendorButton
              vendorId={id}
              isStarred={isStarred}
              size="lg"
              variant="ghost"
              className="h-10 w-10 p-0"
            />
            <h1 className="text-3xl font-semibold tracking-tight">
              {vendor.company || vendor.name}
            </h1>
            <Badge variant={vendor.is_active ? "success" : "secondary"}>
              {vendor.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-muted-foreground">
            {vendor.primary_contact && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span className="text-lg">{vendor.primary_contact.name}</span>
              </div>
            )}
            <Badge variant="outline">
              {VENDOR_SPECIALTY_LABELS[vendor.specialty]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Action Buttons - Hero Section */}
      <div className="flex flex-wrap gap-3">
        {vendor.primary_contact?.phone && (
          <Button size="lg" asChild>
            <a href={`tel:${vendor.primary_contact.phone}`}>
              <Phone className="h-5 w-5 mr-2" />
              Call {vendor.primary_contact.name.split(" ")[0]}
            </a>
          </Button>
        )}
        {vendor.emergency_phone && (
          <Button size="lg" variant="destructive" asChild>
            <a href={`tel:${vendor.emergency_phone}`}>
              <AlertCircle className="h-5 w-5 mr-2" />
              Emergency
            </a>
          </Button>
        )}
        <Button size="lg" variant="outline" asChild>
          <Link href={`/vendors/${vendor.id}/edit`}>
            <Edit className="h-5 w-5 mr-2" />
            Edit
          </Link>
        </Button>
        <DeleteVendorButton vendorId={vendor.id} vendorName={vendor.company || vendor.name} />
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
          {/* Contacts Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VendorContactsList vendorId={vendor.id} contacts={vendor.contacts || []} />
            </CardContent>
          </Card>

          {/* Properties Served */}
          {assignedProperties.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Properties Served
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {assignedProperties.map((property) => (
                    <Link
                      key={property.id}
                      href={`/properties/${property.id}`}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{property.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {property.city}, {property.state || property.country}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company Details */}
          {(vendor.website || vendor.address || vendor.rating || vendor.notes) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {vendor.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <a
                        href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium hover:underline truncate"
                      >
                        {vendor.website}
                      </a>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-base">{vendor.address}</p>
                    </div>
                  )}
                  {vendor.rating && (
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < vendor.rating!
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {vendor.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-base whitespace-pre-wrap">{vendor.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Account & Billing - Collapsible */}
          {hasAccountInfo && (
            <Collapsible>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Account & Billing
                      <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {vendor.account_number && (
                        <div>
                          <p className="text-sm text-muted-foreground">Account Number</p>
                          <p className="text-base font-medium font-mono">
                            {vendor.account_number}
                          </p>
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
                      {vendor.login_info && (
                        <div className="sm:col-span-2 lg:col-span-1">
                          <p className="text-sm text-muted-foreground">Login Info</p>
                          <p className="text-base font-medium font-mono whitespace-pre-wrap">
                            {vendor.login_info}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
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
