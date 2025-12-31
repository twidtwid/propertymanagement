"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FormField, FormSelect, FormTextarea, SubmitButton } from "@/components/forms"
import { useToast } from "@/hooks/use-toast"
import { createInsurancePolicy, updateInsurancePolicy } from "@/lib/mutations"
import { insurancePolicySchema, type InsurancePolicyFormData } from "@/lib/schemas"
import type { InsurancePolicy, Property, Vehicle } from "@/types/database"

interface PolicyFormProps {
  policy?: InsurancePolicy
  properties: Property[]
  vehicles: Vehicle[]
  onSuccess?: (policy: InsurancePolicy) => void
}

const POLICY_TYPE_OPTIONS = [
  { value: "homeowners", label: "Homeowners" },
  { value: "auto", label: "Auto" },
  { value: "umbrella", label: "Umbrella" },
  { value: "flood", label: "Flood" },
  { value: "earthquake", label: "Earthquake" },
  { value: "liability", label: "Liability" },
  { value: "health", label: "Health" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
]

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: "check", label: "Check" },
  { value: "auto_pay", label: "Auto Pay" },
  { value: "online", label: "Online" },
  { value: "wire", label: "Wire Transfer" },
  { value: "other", label: "Other" },
]

export function PolicyForm({ policy, properties, vehicles, onSuccess }: PolicyFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!policy

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InsurancePolicyFormData>({
    resolver: zodResolver(insurancePolicySchema),
    defaultValues: policy
      ? {
          property_id: policy.property_id || undefined,
          vehicle_id: policy.vehicle_id || undefined,
          policy_type: policy.policy_type,
          carrier_name: policy.carrier_name,
          policy_number: policy.policy_number || "",
          agent_name: policy.agent_name || "",
          agent_phone: policy.agent_phone || "",
          agent_email: policy.agent_email || "",
          premium_amount: policy.premium_amount || undefined,
          premium_frequency: policy.premium_frequency || "annual",
          coverage_amount: policy.coverage_amount || undefined,
          deductible: policy.deductible || undefined,
          effective_date: policy.effective_date || "",
          expiration_date: policy.expiration_date || "",
          auto_renew: policy.auto_renew,
          payment_method: policy.payment_method || undefined,
          document_url: policy.document_url || "",
          notes: policy.notes || "",
        }
      : {
          policy_type: "homeowners",
          premium_frequency: "annual",
          auto_renew: true,
        },
  })

  const policyType = watch("policy_type")
  const propertyId = watch("property_id")
  const vehicleId = watch("vehicle_id")
  const premiumFrequency = watch("premium_frequency")
  const paymentMethod = watch("payment_method")
  const autoRenew = watch("auto_renew")

  const onSubmit = async (data: InsurancePolicyFormData) => {
    const result = isEditing
      ? await updateInsurancePolicy(policy.id, data)
      : await createInsurancePolicy(data)

    if (result.success) {
      toast({
        title: isEditing ? "Policy updated" : "Policy created",
        description: `${data.carrier_name} policy has been ${isEditing ? "updated" : "added"} successfully.`,
      })

      if (onSuccess) {
        onSuccess(result.data)
      } else {
        router.push("/insurance")
      }
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Policy Information */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormSelect
              label="Policy Type"
              name="policy_type"
              value={policyType}
              onChange={(value) =>
                setValue("policy_type", value as InsurancePolicyFormData["policy_type"])
              }
              options={POLICY_TYPE_OPTIONS}
              error={errors.policy_type?.message}
              required
            />
            <FormField
              label="Carrier Name"
              {...register("carrier_name")}
              error={errors.carrier_name?.message}
              placeholder="e.g., Berkley One"
              required
            />
          </div>

          <FormField
            label="Policy Number"
            {...register("policy_number")}
            error={errors.policy_number?.message}
            placeholder="Policy number"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormSelect
              label="Property"
              name="property_id"
              value={propertyId || ""}
              onChange={(value) => {
                setValue("property_id", value || null)
                if (value) setValue("vehicle_id", null)
              }}
              options={[
                { value: "", label: "None" },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <FormSelect
              label="Vehicle"
              name="vehicle_id"
              value={vehicleId || ""}
              onChange={(value) => {
                setValue("vehicle_id", value || null)
                if (value) setValue("property_id", null)
              }}
              options={[
                { value: "", label: "None" },
                ...vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.year} ${v.make} ${v.model}`,
                })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Agent Information */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            label="Agent Name"
            {...register("agent_name")}
            error={errors.agent_name?.message}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Agent Phone"
              type="tel"
              {...register("agent_phone")}
              error={errors.agent_phone?.message}
            />
            <FormField
              label="Agent Email"
              type="email"
              {...register("agent_email")}
              error={errors.agent_email?.message}
            />
          </div>
        </CardContent>
      </Card>

      {/* Coverage & Premiums */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage & Premiums</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Coverage Amount"
              type="number"
              step="0.01"
              {...register("coverage_amount")}
              error={errors.coverage_amount?.message}
            />
            <FormField
              label="Deductible"
              type="number"
              step="0.01"
              {...register("deductible")}
              error={errors.deductible?.message}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              label="Premium Amount"
              type="number"
              step="0.01"
              {...register("premium_amount")}
              error={errors.premium_amount?.message}
            />
            <FormSelect
              label="Premium Frequency"
              name="premium_frequency"
              value={premiumFrequency}
              onChange={(value) =>
                setValue("premium_frequency", value as InsurancePolicyFormData["premium_frequency"])
              }
              options={FREQUENCY_OPTIONS}
            />
            <FormSelect
              label="Payment Method"
              name="payment_method"
              value={paymentMethod || ""}
              onChange={(value) =>
                setValue("payment_method", (value || null) as InsurancePolicyFormData["payment_method"])
              }
              options={[{ value: "", label: "Not specified" }, ...PAYMENT_METHOD_OPTIONS]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Effective Date"
              type="date"
              {...register("effective_date")}
              error={errors.effective_date?.message}
            />
            <FormField
              label="Expiration Date"
              type="date"
              {...register("expiration_date")}
              error={errors.expiration_date?.message}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto_renew"
              checked={autoRenew}
              onCheckedChange={(checked) => setValue("auto_renew", !!checked)}
            />
            <Label htmlFor="auto_renew">Auto-renew policy</Label>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            label="Document URL"
            type="url"
            {...register("document_url")}
            error={errors.document_url?.message}
            placeholder="https://..."
          />
          <FormTextarea
            label="Notes"
            {...register("notes")}
            placeholder="Additional notes..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <SubmitButton isLoading={isSubmitting} size="lg">
          {isEditing ? "Save Changes" : "Create Policy"}
        </SubmitButton>
      </div>
    </form>
  )
}
