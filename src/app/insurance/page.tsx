export const dynamic = 'force-dynamic'

import { getInsurancePoliciesFiltered, getExpiringPolicies, getSmartAndUserPins, getPinNotesByEntities, getUserPinNote, getInsuranceCarriers } from "@/lib/actions"
import { getUser } from "@/lib/auth"
import { InsuranceWithPins } from "@/components/insurance/insurance-with-pins"

interface InsurancePageProps {
  searchParams: Promise<{
    type?: string
    carrier?: string
    status?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }>
}

export default async function InsurancePage({ searchParams }: InsurancePageProps) {
  const params = await searchParams
  const [policies, expiring, pins, user, carriers] = await Promise.all([
    getInsurancePoliciesFiltered({
      type: params.type,
      carrier: params.carrier,
      status: params.status,
      search: params.search,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
    getExpiringPolicies(60),
    getSmartAndUserPins('insurance_policy'),
    getUser(),
    getInsuranceCarriers(),
  ])

  // Get all pinned policy IDs
  const allPinnedIds = [...Array.from(pins.smartPins), ...Array.from(pins.userPins)]

  // Load notes for all pinned policies
  const notesMap = await getPinNotesByEntities('insurance_policy', allPinnedIds)

  // Get user's notes for each pinned policy
  const userNotesMap = new Map<string, any>()
  if (user) {
    for (const policyId of allPinnedIds) {
      const userNote = await getUserPinNote('insurance_policy', policyId, user.id)
      if (userNote) {
        userNotesMap.set(policyId, userNote)
      }
    }
  }

  return (
    <InsuranceWithPins
      policies={policies}
      expiring={expiring}
      initialSmartPins={Array.from(pins.smartPins)}
      initialUserPins={Array.from(pins.userPins)}
      initialNotesMap={Object.fromEntries(notesMap)}
      initialUserNotesMap={Object.fromEntries(userNotesMap)}
      carriers={carriers}
      sortBy={params.sortBy}
      sortOrder={params.sortOrder}
    />
  )
}
