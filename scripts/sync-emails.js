#!/usr/bin/env node
/**
 * Email Sync Script
 *
 * Syncs emails from Gmail to the vendor_communications table.
 *
 * Usage:
 *   Run manually: node scripts/sync-emails.js
 *   Run continuously: node scripts/sync-emails.js --watch
 *   Run with interval: node scripts/sync-emails.js --watch --interval=5
 *
 * Cron example (every 10 min):
 *   crontab: 0,10,20,30,40,50 * * * * cd /path/to/project && node scripts/sync-emails.js
 */

const { Pool } = require('pg');
const { google } = require('googleapis');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2];
});

const DATABASE_URL = envVars.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/propertymanagement';
const pool = new Pool({ connectionString: DATABASE_URL });

// Decryption
function decryptToken(encryptedBase64) {
  const key = Buffer.from(envVars.TOKEN_ENCRYPTION_KEY, 'hex');
  const combined = Buffer.from(encryptedBase64, 'base64');
  const iv = combined.subarray(0, 16);
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(16, combined.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// Get active vendors for matching
async function getActiveVendors() {
  const result = await pool.query(`
    SELECT id, name, email, company, specialty
    FROM vendors
    WHERE is_active = TRUE AND email IS NOT NULL AND email != ''
  `);
  return result.rows;
}

// Parse vendor emails
function parseVendorEmails(emailField) {
  if (!emailField) return [];
  return emailField
    .split(/[,;]/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0 && e.includes('@'));
}

// Extract domain from email
function extractDomain(email) {
  const match = email.toLowerCase().match(/@([^@]+)$/);
  return match ? match[1] : null;
}

// Match email to vendor
async function matchEmailToVendor(senderEmail, senderName, vendors) {
  const senderEmailLower = senderEmail.toLowerCase();
  const senderDomain = extractDomain(senderEmailLower);

  const commonDomains = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'aol.com', 'comcast.net', 'verizon.net'
  ]);

  // Exact match
  for (const vendor of vendors) {
    const vendorEmails = parseVendorEmails(vendor.email);
    if (vendorEmails.includes(senderEmailLower)) {
      return { vendorId: vendor.id, vendorName: vendor.name, matchType: 'exact' };
    }
  }

  // Domain match
  if (senderDomain && !commonDomains.has(senderDomain)) {
    for (const vendor of vendors) {
      const vendorEmails = parseVendorEmails(vendor.email);
      for (const vendorEmail of vendorEmails) {
        if (extractDomain(vendorEmail) === senderDomain) {
          return { vendorId: vendor.id, vendorName: vendor.name, matchType: 'domain' };
        }
      }
    }
  }

  // Name match
  if (senderName) {
    const senderNameLower = senderName.toLowerCase();
    for (const vendor of vendors) {
      const vendorNameLower = vendor.name.toLowerCase();
      const companyLower = (vendor.company || '').toLowerCase();
      if ((vendorNameLower.length > 3 && senderNameLower.includes(vendorNameLower)) ||
          (companyLower.length > 3 && senderNameLower.includes(companyLower))) {
        return { vendorId: vendor.id, vendorName: vendor.name, matchType: 'name' };
      }
    }
  }

  return { vendorId: null, vendorName: null, matchType: null };
}

// Check if email is urgent
function isUrgentEmail(subject, snippet) {
  const urgentKeywords = [
    'urgent', 'emergency', 'immediate', 'asap', 'critical',
    'time-sensitive', 'action required', 'important'
  ];
  const text = ((subject || '') + ' ' + (snippet || '')).toLowerCase();
  return urgentKeywords.some(kw => text.includes(kw));
}

// Check if email exists
async function emailExists(gmailMessageId) {
  const result = await pool.query(
    'SELECT 1 FROM vendor_communications WHERE gmail_message_id = $1 LIMIT 1',
    [gmailMessageId]
  );
  return result.rows.length > 0;
}

// Store email
async function storeEmail(email, vendorId, direction, isImportant) {
  try {
    const result = await pool.query(`
      INSERT INTO vendor_communications (
        vendor_id, gmail_message_id, thread_id, direction,
        from_email, to_email, subject, body_snippet, body_html,
        received_at, is_read, is_important, has_attachment,
        attachment_names, labels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (gmail_message_id) DO NOTHING
      RETURNING id
    `, [
      vendorId,
      email.messageId,
      email.threadId,
      direction,
      email.from,
      email.to,
      email.subject,
      email.snippet,
      email.bodyHtml,
      email.receivedAt,
      false,
      isImportant,
      email.hasAttachments,
      email.attachmentNames || [],
      email.labels || []
    ]);
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('  Error storing email:', error.message);
    return null;
  }
}

// Get sync state
async function getSyncState() {
  const userEmail = envVars.NOTIFICATION_EMAIL || 'anne@annespalter.com';
  const result = await pool.query(
    'SELECT last_sync_at FROM email_sync_state WHERE user_email = $1',
    [userEmail]
  );
  return result.rows[0]?.last_sync_at || null;
}

// Update sync state
async function updateSyncState() {
  const userEmail = envVars.NOTIFICATION_EMAIL || 'anne@annespalter.com';
  await pool.query(`
    INSERT INTO email_sync_state (user_email, last_sync_at, sync_count)
    VALUES ($1, NOW(), 1)
    ON CONFLICT (user_email)
    DO UPDATE SET last_sync_at = NOW(), sync_count = email_sync_state.sync_count + 1
  `, [userEmail]);
}

// Parse email message
function parseMessage(message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const fromRaw = getHeader('From');
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
  const fromEmail = fromMatch ? fromMatch[2] : fromRaw;
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : null;

  const toRaw = getHeader('To');

  // Extract body
  let bodyHtml = null;
  let bodyText = null;

  function extractBody(parts, mimeType) {
    if (!parts) return null;
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf8');
      }
      if (part.parts) {
        const nested = extractBody(part.parts, mimeType);
        if (nested) return nested;
      }
    }
    return null;
  }

  if (message.payload.body?.data) {
    const decoded = Buffer.from(message.payload.body.data, 'base64url').toString('utf8');
    if (message.payload.mimeType === 'text/html') {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
  }

  if (message.payload.parts) {
    bodyHtml = bodyHtml || extractBody(message.payload.parts, 'text/html');
    bodyText = bodyText || extractBody(message.payload.parts, 'text/plain');
  }

  // Extract attachments
  const attachmentNames = [];
  function extractAttachments(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachmentNames.push(part.filename);
      }
      if (part.parts) extractAttachments(part.parts);
    }
  }
  extractAttachments(message.payload.parts);

  return {
    messageId: message.id,
    threadId: message.threadId,
    from: fromEmail,
    fromName: fromName,
    to: toRaw,
    subject: getHeader('Subject'),
    snippet: message.snippet,
    bodyHtml: bodyHtml,
    bodyText: bodyText,
    receivedAt: new Date(parseInt(message.internalDate)),
    labels: message.labelIds || [],
    hasAttachments: attachmentNames.length > 0,
    attachmentNames: attachmentNames
  };
}

// Main sync function
async function syncEmails() {
  const userEmail = envVars.NOTIFICATION_EMAIL || 'anne@annespalter.com';
  const timestamp = new Date().toISOString();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  EMAIL SYNC - ${timestamp}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Get OAuth tokens
    const tokenResult = await pool.query(
      'SELECT * FROM gmail_oauth_tokens WHERE user_email = $1',
      [userEmail]
    );

    if (tokenResult.rows.length === 0) {
      console.log('❌ No Gmail tokens found. Please connect Gmail first.');
      return { success: false, error: 'No tokens' };
    }

    const tokenRow = tokenResult.rows[0];
    const accessToken = decryptToken(tokenRow.access_token_encrypted);
    const refreshToken = decryptToken(tokenRow.refresh_token_encrypted);

    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      envVars.GOOGLE_CLIENT_ID,
      envVars.GOOGLE_CLIENT_SECRET,
      envVars.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: new Date(tokenRow.token_expiry).getTime()
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Build query based on last sync
    const lastSync = await getSyncState();
    let query = '';
    if (lastSync) {
      const since = new Date(new Date(lastSync).getTime() - 24 * 60 * 60 * 1000);
      query = `after:${since.toISOString().split('T')[0].replace(/-/g, '/')}`;
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = `after:${thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '/')}`;
    }

    console.log(`📧 Fetching emails: ${query}`);

    // Fetch message list
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100
    });

    const messages = response.data.messages || [];
    console.log(`   Found ${messages.length} messages`);

    if (messages.length === 0) {
      await updateSyncState();
      console.log('\n✅ No new messages. Sync complete.\n');
      return { success: true, emailsStored: 0 };
    }

    // Filter out already-processed
    const newMessageIds = [];
    for (const msg of messages) {
      if (!(await emailExists(msg.id))) {
        newMessageIds.push(msg.id);
      }
    }

    console.log(`   ${newMessageIds.length} new messages to process`);

    if (newMessageIds.length === 0) {
      await updateSyncState();
      console.log('\n✅ All messages already processed. Sync complete.\n');
      return { success: true, emailsStored: 0 };
    }

    // Get vendors for matching
    const vendors = await getActiveVendors();
    console.log(`   ${vendors.length} active vendors for matching`);

    // Process messages
    let stored = 0;
    let matched = 0;
    let urgent = 0;

    for (const msgId of newMessageIds.slice(0, 50)) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msgId,
          format: 'full'
        });

        const parsed = parseMessage(detail.data);
        const match = await matchEmailToVendor(parsed.from, parsed.fromName, vendors);
        const direction = parsed.from.toLowerCase() === userEmail.toLowerCase() ? 'outbound' : 'inbound';
        const isImportant = isUrgentEmail(parsed.subject, parsed.snippet);

        if (match.vendorId) matched++;
        if (isImportant) urgent++;

        const id = await storeEmail(parsed, match.vendorId, direction, isImportant);
        if (id) {
          stored++;
          const matchInfo = match.vendorId ? ` → ${match.vendorName} (${match.matchType})` : '';
          const urgentInfo = isImportant ? ' ⚠️ URGENT' : '';
          console.log(`   ✓ ${parsed.subject?.substring(0, 50) || '(no subject)'}${matchInfo}${urgentInfo}`);
        }
      } catch (error) {
        console.error(`   ✗ Error processing ${msgId}: ${error.message}`);
      }
    }

    await updateSyncState();

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  SYNC COMPLETE`);
    console.log(`  Stored: ${stored} | Matched: ${matched} | Urgent: ${urgent}`);
    console.log(`${'─'.repeat(60)}\n`);

    return { success: true, emailsStored: stored, emailsMatched: matched, urgentEmails: urgent };

  } catch (error) {
    const errMsg = error.message || error.toString() || 'Unknown error';
    console.error('\n❌ Sync error:', errMsg);
    if (errMsg.includes('decrypt') || errMsg.includes('key') || errMsg.includes('iv')) {
      console.error('   This may be a token encryption issue. Check TOKEN_ENCRYPTION_KEY in .env.local');
    }
    return { success: false, error: errMsg };
  }
}

// Run mode
const args = process.argv.slice(2);
const watchMode = args.includes('--watch') || args.includes('-w');
const intervalMinutes = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '10');

if (watchMode) {
  console.log(`\n🔄 Starting email sync in watch mode (every ${intervalMinutes} minutes)`);
  console.log('   Press Ctrl+C to stop\n');

  // Run immediately
  syncEmails();

  // Then run on interval
  setInterval(syncEmails, intervalMinutes * 60 * 1000);
} else {
  // Single run
  syncEmails().then(() => {
    pool.end();
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });
}
