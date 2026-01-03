import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getPinNotes, getUserPinNote } from "@/lib/actions"

export async function GET(request: NextRequest) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required parameters: entityType, entityId" },
        { status: 400 }
      )
    }

    const [notes, userNote] = await Promise.all([
      getPinNotes(entityType as any, entityId),
      getUserPinNote(entityType as any, entityId, user.id),
    ])

    return NextResponse.json({ notes, userNote })
  } catch (error) {
    console.error("[Pin Notes API] Get error:", error)
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    )
  }
}
