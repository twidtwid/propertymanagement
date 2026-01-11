#!/usr/bin/env node
/**
 * Send Pushover notification for Phase 3B completion.
 * Run with: node scripts/notify-phase3b-complete.js
 */

async function sendNotification() {
  const PUSHOVER_API_URL = "https://api.pushover.net/1/messages.json"

  const token = process.env.PUSHOVER_TOKEN
  const userKey = process.env.PUSHOVER_USER_TODD

  if (!token || !userKey) {
    console.error("❌ Missing PUSHOVER_TOKEN or PUSHOVER_USER_TODD environment variables")
    process.exit(1)
  }

  const message = `🎉 Phase 3B Complete!

Migrated 4 major domains:
• vendors.ts (213 lines, 11 functions)
• insurance.ts (188 lines, 7 functions)
• taxes.ts (159 lines, 6 functions)
• payments.ts (374 lines, 5 functions)

Overall: 13.2% complete (975/7,399 lines)

QA: All domains tested ✓
• TypeScript: Pass
• Tests: 8/8 pass
• Browser: All pages loading correctly

Commit: Phase 3B domain migration complete
Ready for Phase 3C (complex domains)`

  const body = new URLSearchParams({
    token,
    user: userKey,
    message,
    title: "Phase 3B Migration Complete",
    priority: "0",
  })

  try {
    const response = await fetch(PUSHOVER_API_URL, {
      method: "POST",
      body,
    })
    const result = await response.json()

    if (result.status === 1) {
      console.log("✅ Pushover notification sent successfully!")
      process.exit(0)
    } else {
      console.error("❌ Pushover API error:", result.errors?.join(", ") || "Unknown error")
      process.exit(1)
    }
  } catch (error) {
    console.error("❌ Failed to send notification:", error)
    process.exit(1)
  }
}

sendNotification()
