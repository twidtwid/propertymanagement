import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { deletePinNote } from "@/lib/mutations"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Missing note ID" }, { status: 400 })
    }

    const result = await deletePinNote(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Pin Notes API] Delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    )
  }
}
