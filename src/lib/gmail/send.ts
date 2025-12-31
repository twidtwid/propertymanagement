import { getGmailClient } from "./client"

/**
 * Create a MIME email message for Gmail API.
 */
function createMimeMessage(
  to: string,
  subject: string,
  htmlBody: string,
  from?: string
): string {
  const boundary = `boundary_${Date.now()}`
  const fromAddress = from || process.env.NOTIFICATION_EMAIL || "noreply@example.com"

  const messageParts = [
    `From: ${fromAddress}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    htmlBody.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " "), // Strip HTML for plain text
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    htmlBody,
    "",
    `--${boundary}--`,
  ]

  return messageParts.join("\r\n")
}

/**
 * Encode a message for the Gmail API (base64url).
 */
function encodeMessage(message: string): string {
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/**
 * Send an email via Gmail API.
 *
 * @param userEmail - The authenticated Gmail user (sender)
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param htmlBody - HTML content of the email
 * @returns Gmail message ID of the sent email
 */
export async function sendEmail(
  userEmail: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<string> {
  const gmail = await getGmailClient(userEmail)

  const mimeMessage = createMimeMessage(to, subject, htmlBody, userEmail)
  const encodedMessage = encodeMessage(mimeMessage)

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  })

  if (!response.data.id) {
    throw new Error("Failed to send email - no message ID returned")
  }

  console.log(`[Gmail] Email sent: ${subject} -> ${to} (ID: ${response.data.id})`)

  return response.data.id
}

/**
 * Send the daily summary email.
 */
export async function sendDailySummaryEmail(
  userEmail: string,
  recipientEmail: string,
  summaryHtml: string,
  date: string
): Promise<string> {
  const subject = `Daily Property Summary - ${date}`

  return sendEmail(userEmail, recipientEmail, subject, summaryHtml)
}

/**
 * Send an urgent notification email.
 */
export async function sendUrgentNotificationEmail(
  userEmail: string,
  recipientEmail: string,
  notificationType: string,
  title: string,
  details: string
): Promise<string> {
  const subject = `[URGENT] ${title}`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .urgent-banner { background: #ef4444; color: white; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .urgent-banner h1 { margin: 0; font-size: 20px; }
    .content { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="urgent-banner">
    <h1>URGENT: ${title}</h1>
  </div>
  <div class="content">
    <p><strong>Type:</strong> ${notificationType}</p>
    <p>${details}</p>
  </div>
  <div class="footer">
    <p>This urgent notification was sent by your Property Management System.</p>
    <p>View details at: <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}">${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}</a></p>
  </div>
</body>
</html>
`

  return sendEmail(userEmail, recipientEmail, subject, htmlBody)
}
