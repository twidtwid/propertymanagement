export const dynamic = 'force-dynamic'

import { getInsurancePolicies, getExpiringPolicies, getSmartAndUserPins, getPinNotesByEntities, getUserPinNote } from "@/lib/actions"
import { getUser } from "@/lib/auth"
import { InsuranceWithPins } from "@/components/insurance/insurance-with-pins"

export default async function InsurancePage() {
  const [policies, expiring, pins, user] = await Promise.all([
    getInsurancePolicies(),
    getExpiringPolicies(60),
    getSmartAndUserPins('insurance_policy'),
    getUser(),
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
    />
  )
}
