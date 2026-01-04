import dynamic from "next/dynamic"
import { Building, ExternalLink } from "lucide-react"
import Link from "next/link"
import { getUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  getBuildingLinkMessages,
  getSmartAndUserPins,
  getBuildingLinkNeedsAttention,
  getPinNotesByEntities,
  getUserPinNote,
  type BuildingLinkMessage,
} from "@/lib/actions"

// Dynamic import with ssr: false to avoid hydration mismatches from timezone differences
const BuildingLinkClient = dynamic(() => import("./client").then(mod => mod.BuildingLinkClient), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" />,
})

interface BuildingLinkPageProps {
  searchParams: Promise<{
    tab?: string
    search?: string
  }>
}

export default async function BuildingLinkPage({ searchParams }: BuildingLinkPageProps) {
  const user = await getUser()
  if (!user) {
    redirect("/auth/login")
  }

  const params = await searchParams
  const currentTab = params.tab || "activity"

  // Fetch data in parallel (social messages always hidden)
  const [allMessages, pins, needsAttention] = await Promise.all([
    getBuildingLinkMessages({
      limit: 500,
      search: params.search,
    }),
    getSmartAndUserPins('buildinglink_message'),
    getBuildingLinkNeedsAttention(),
  ])

  // Filter out social messages
  const messages = allMessages.filter(msg => msg.category !== 'social')

  // Filter messages based on current tab
  let filteredMessages = messages
  if (currentTab === "security") {
    filteredMessages = messages.filter((m) => m.category === "security")
  } else if (currentTab === "packages") {
    filteredMessages = messages.filter((m) => m.category === "package")
  } else if (currentTab === "elevator") {
    filteredMessages = messages.filter((m) => m.subject.toLowerCase().includes("elevator"))
  }
  // "activity" and "journal" tabs show all messages (already filtered by includeSocial)

  // Get all pinned message IDs
  const allPinnedIds = [...Array.from(pins.smartPins), ...Array.from(pins.userPins)]

  // Load notes for all pinned messages
  const notesMap = await getPinNotesByEntities('buildinglink_message', allPinnedIds)

  // Get user's notes for each pinned message
  const userNotesMap = new Map<string, any>()
  for (const messageId of allPinnedIds) {
    const userNote = await getUserPinNote('buildinglink_message', messageId, user.id)
    if (userNote) {
      userNotesMap.set(messageId, userNote)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">BuildingLink</h1>
            <p className="text-sm text-muted-foreground">
              North Edge (PH2E & PH2F)
            </p>
          </div>
        </div>
        <Link
          href="https://www.buildinglink.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Open BuildingLink <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Client-side interactive content */}
      <BuildingLinkClient
        messages={filteredMessages}
        allMessages={messages}
        smartPins={Array.from(pins.smartPins)}
        userPins={Array.from(pins.userPins)}
        uncollectedPackages={needsAttention.uncollectedPackages}
        currentTab={currentTab}
        searchQuery={params.search || ""}
        initialNotesMap={Object.fromEntries(notesMap)}
        initialUserNotesMap={Object.fromEntries(userNotesMap)}
      />
    </div>
  )
}
