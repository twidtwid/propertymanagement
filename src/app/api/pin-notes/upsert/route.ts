import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { upsertPinNote } from "@/lib/mutations"

export async function POST(request: NextRequest) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entityType, entityId, note, dueDate } = body

    if (!entityType || !entityId || !note) {
      return NextResponse.json(
        { error: "Missing required fields: entityType, entityId, note" },
        { status: 400 }
      )
    }

    const result = await upsertPinNote({
      entityType,
      entityId,
      userId: user.id,
      userName: user.full_name?.toLowerCase() || user.email.split('@')[0].toLowerCase(),
      note,
      dueDate: dueDate || null,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Pin Notes API] Upsert error:", error)
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    )
  }
}
