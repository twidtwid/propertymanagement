import { NextRequest, NextResponse } from "next/server"
import { getCalendarEvents } from "@/lib/actions"
import { withApiAuth } from "@/lib/api-auth"
import { ApiErrors } from "@/lib/api-error"

export const GET = withApiAuth(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const start = searchParams.get("start")
  const end = searchParams.get("end")

  if (!start || !end) {
    return ApiErrors.badRequest("start and end date parameters are required")
  }

  try {
    const events = await getCalendarEvents(start, end)
    return NextResponse.json(events)
  } catch (error) {
    console.error("Failed to fetch calendar events:", error)
    return ApiErrors.serverError("Failed to fetch calendar events")
  }
})
