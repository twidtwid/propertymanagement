import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Edit,
  Shield,
  Building,
  Car,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  AlertTriangle,
  Trash2,
} from "lucide-react"
import { getInsurancePolicy } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { INSURANCE_TYPE_LABELS, RECURRENCE_LABELS } from "@/types/database"
import { CoverageDetails } from "@/types/database"

function CoverageBreakdown({ coverage }: { coverage: CoverageDetails | null }) {
  if (!coverage) return null

  const items = Object.entries(coverage).filter(
    ([key, value]) => value !== undefined && value !== null
  )

  if (items.length === 0) return null

  const labelMap: Record<string, string> = {
    dwelling: "Dwelling",
    other_structures: "Other Structures",
    contents: "Contents",
    personal_liability: "Personal Liability",
    medical_payments: "Medical Payments",
    loss_of_use: "Loss of Use",
    collision: "Collision Deductible",
    comprehensive: "Comprehensive Deductible",
    bodily_injury: "Bodily Injury",
    property_damage: "Property Damage",
    uninsured_motorist: "Uninsured Motorist",
    improvements: "Improvements & Betterments",
  }

  return (
    <div className="space-y-2">
      {items.map(([key, value]) => (
        <div key={key} className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {labelMap[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </span>
          <span className="font-medium">
            {key.includes("deductible") ? formatCurrency(value as number) : formatCurrency(value as number)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ExpirationBadge({ date }: { date: string | null }) {
  if (!date) return <Badge variant="secondary">No expiration</Badge>

  const expDate = new Date(date)
  const today = new Date()
  const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) {
    return <Badge variant="destructive">Expired</Badge>
  } else if (daysUntil <= 30) {
    return <Badge variant="destructive">Expires in {daysUntil} days</Badge>
  } else if (daysUntil <= 60) {
    return <Badge variant="warning">Expires in {daysUntil} days</Badge>
  }
  return <Badge variant="success">Active</Badge>
}

export default async function InsurancePolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const policy = await getInsurancePolicy(id)

  if (!policy) {
    notFound()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/insurance">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-semibold tracking-tight">
              {policy.carrier_name}
            </h1>
            <Badge variant="outline">
              {INSURANCE_TYPE_LABELS[policy.policy_type]}
            </Badge>
            <ExpirationBadge date={policy.expiration_date} />
          </div>
          {policy.policy_number && (
            <p className="text-lg text-muted-foreground mt-1 font-mono">
              Policy #{policy.policy_number}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="lg" variant="outline" asChild>
            <Link href={`/insurance/${policy.id}/edit`}>
              <Edit className="h-5 w-5 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coverage & Premium */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Coverage & Premium
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {policy.coverage_amount && (
              <div>
                <p className="text-sm text-muted-foreground">Total Coverage</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(policy.coverage_amount)}
                </p>
              </div>
            )}
            {policy.premium_amount && (
              <div>
                <p className="text-sm text-muted-foreground">Premium</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(policy.premium_amount)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {RECURRENCE_LABELS[policy.premium_frequency].toLowerCase()}
                  </span>
                </p>
              </div>
            )}
            {policy.deductible && (
              <div>
                <p className="text-sm text-muted-foreground">Deductible</p>
                <p className="text-base font-medium">
                  {formatCurrency(policy.deductible)}
                </p>
              </div>
            )}
            {policy.payment_method && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="text-base font-medium capitalize">
                  {policy.payment_method.replace(/_/g, " ")}
                </p>
              </div>
            )}
            {policy.auto_renew && (
              <Badge variant="outline" className="mt-2">
                Auto-renew enabled
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Policy Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Policy Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {policy.effective_date && (
              <div>
                <p className="text-sm text-muted-foreground">Effective Date</p>
                <p className="text-base font-medium">
                  {formatDate(policy.effective_date)}
                </p>
              </div>
            )}
            {policy.expiration_date && (
              <div>
                <p className="text-sm text-muted-foreground">Expiration Date</p>
                <p className="text-base font-medium">
                  {formatDate(policy.expiration_date)}
                </p>
              </div>
            )}
            {!policy.effective_date && !policy.expiration_date && (
              <p className="text-muted-foreground">No dates on file</p>
            )}
          </CardContent>
        </Card>

        {/* Agent Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Agent Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {policy.agent_name && (
              <div>
                <p className="text-sm text-muted-foreground">Agent</p>
                <p className="text-base font-medium">{policy.agent_name}</p>
              </div>
            )}
            {policy.agent_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`tel:${policy.agent_phone}`}
                  className="text-primary hover:underline"
                >
                  {policy.agent_phone}
                </a>
              </div>
            )}
            {policy.agent_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${policy.agent_email}`}
                  className="text-primary hover:underline"
                >
                  {policy.agent_email}
                </a>
              </div>
            )}
            {!policy.agent_name && !policy.agent_phone && !policy.agent_email && (
              <p className="text-muted-foreground">No agent info on file</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coverage Details */}
      {policy.coverage_details && Object.keys(policy.coverage_details).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Coverage Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <CoverageBreakdown coverage={policy.coverage_details} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Asset */}
      {(policy.property || policy.vehicle) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {policy.property ? (
                <Building className="h-5 w-5" />
              ) : (
                <Car className="h-5 w-5" />
              )}
              {policy.property ? "Covered Property" : "Covered Vehicle"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {policy.property && (
              <Link
                href={`/properties/${policy.property.id}`}
                className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-lg font-medium">{policy.property.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {policy.property.address}, {policy.property.city}
                  </p>
                </div>
                <Badge variant="outline">{policy.property.property_type}</Badge>
              </Link>
            )}
            {policy.vehicle && (
              <Link
                href={`/vehicles/${policy.vehicle.id}`}
                className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-lg font-medium">
                    {policy.vehicle.year} {policy.vehicle.make} {policy.vehicle.model}
                  </p>
                  {policy.vehicle.license_plate && (
                    <p className="text-sm text-muted-foreground">
                      {policy.vehicle.license_plate} ({policy.vehicle.registration_state})
                    </p>
                  )}
                </div>
                {policy.vehicle.color && (
                  <Badge variant="outline">{policy.vehicle.color}</Badge>
                )}
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {policy.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base whitespace-pre-wrap">{policy.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Document Link */}
      {policy.document_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Policy Document</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={policy.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <FileText className="h-4 w-4" />
              View Policy Document
            </a>
          </CardContent>
        </Card>
      )}

      {/* Claims Section Placeholder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Claims History
          </CardTitle>
          <Button variant="outline" size="sm">
            File Claim
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No claims on file for this policy
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
