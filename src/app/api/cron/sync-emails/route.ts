import { NextRequest, NextResponse } from "next/server"
import { syncEmails } from "@/lib/gmail/sync"
import { scanEmailsForPaymentSuggestions } from "@/lib/payments/suggestions"
import { autoMatchEmailsToPayments, createBillsFromConfirmationEmails } from "@/lib/payments/email-links"

/**
 * GET /api/cron/sync-emails
 * Syncs new emails from Gmail and scans for payment suggestions.
 * Should be called every 10 minutes by Vercel Cron.
 */
export async function GET(request: NextRequest) {
  // Always verify cron secret (no dev bypass for security)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[Cron] Starting email sync...")

    const result = await syncEmails({
      maxResults: 100,
    })

    console.log("[Cron] Email sync complete:", result)

    // Scan newly synced emails for payment suggestions
    let suggestionsCreated = 0
    try {
      suggestionsCreated = await scanEmailsForPaymentSuggestions(14, true)
      console.log("[Cron] Payment suggestions created:", suggestionsCreated)
    } catch (scanError) {
      console.error("[Cron] Payment suggestion scan error:", scanError)
      // Don't fail the whole sync if suggestion scanning fails
    }

    // Create bills from confirmation emails (auto-pay processing)
    let billsFromEmails = 0
    try {
      billsFromEmails = await createBillsFromConfirmationEmails(14)
      console.log("[Cron] Bills created from confirmation emails:", billsFromEmails)
    } catch (billError) {
      console.error("[Cron] Bill creation from emails error:", billError)
    }

    // Auto-match confirmation emails to existing bills
    let emailLinksCreated = 0
    try {
      emailLinksCreated = await autoMatchEmailsToPayments(14, 0.7)
      console.log("[Cron] Email links created:", emailLinksCreated)
    } catch (linkError) {
      console.error("[Cron] Email link matching error:", linkError)
    }

    const message = result.success
      ? `Synced ${result.emailsStored} emails (${result.emailsMatched} matched to vendors), ${suggestionsCreated} suggestions, ${billsFromEmails} bills, ${emailLinksCreated} email links`
      : "Sync failed"

    return NextResponse.json({
      ...result,
      suggestionsCreated,
      billsFromEmails,
      emailLinksCreated,
      message,
    })
  } catch (error) {
    console.error("[Cron] Sync error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Vercel cron configuration
export const dynamic = "force-dynamic"
export const maxDuration = 60 // 60 seconds max
