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

// Read .env.local (for local development) - optional in production
const envVars = {};
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) envVars[match[1]] = match[2];
    });
  }
} catch (err) {
  // .env.local not found - using process.env only (expected in Docker)
}

// Use process.env first (for Docker), then .env.local file, then default
const DATABASE_URL = process.env.DATABASE_URL || envVars.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/propertymanagement';
const pool = new Pool({ connectionString: DATABASE_URL });

console.log('Using database:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

// Decryption
function decryptToken(encryptedBase64) {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || envVars.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY not set in environment');
  }
  const key = Buffer.from(encryptionKey, 'hex');
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
    SELECT id, name, email, company, specialties
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

// Extract root domain (handles subdomains like us1.buildinglink.com -> buildinglink.com)
function extractRootDomain(domain) {
  if (!domain) return null;
  const parts = domain.split('.');
  // Handle cases like co.uk, com.au etc
  if (parts.length >= 2) {
    // Simple approach: take last 2 parts
    return parts.slice(-2).join('.');
  }
  return domain;
}

// Keywords indicating payment confirmation emails
const CONFIRMATION_KEYWORDS = [
  'payment received', 'payment confirmed', 'payment successful',
  'payment processed', 'thank you for your payment', 'payment complete',
  'auto-pay processed', 'automatic payment', 'has been paid',
  'has been received',  // Dead River: "Your payment has been received"
  'transaction complete', 'payment notification', 'autopay payment confirmation',
  'payment date:'  // Used by Public Parking receipts
];

function isConfirmationEmailText(subject, bodySnippet, bodyHtml) {
  const text = [subject, bodySnippet, bodyHtml].filter(Boolean).join(' ').toLowerCase();
  return CONFIRMATION_KEYWORDS.some(keyword => text.includes(keyword));
}

function extractAmountFromText(text) {
  if (!text) return null;
  const patterns = [
    /\$\s*([\d,]+\.?\d{0,2})/g,
    /(?:amount|total|payment)[:\s]*\$?([\d,]+\.?\d{0,2})/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 100000) {
        return parsed;
      }
    }
  }
  return null;
}

// Try to find a vendor ID by matching vendor names in the email subject
// Used for emails from payment processors (e.g., speedpay.com) that don't directly match a vendor
async function findVendorFromSubject(subject) {
  if (!subject) return null;

  // Get all vendor names
  const result = await pool.query(`
    SELECT id, name FROM vendors WHERE name IS NOT NULL
  `);
  const vendors = result.rows;

  const subjectLower = subject.toLowerCase();

  // Find the best match - longest vendor name that appears in the subject
  let bestMatch = null;

  for (const vendor of vendors) {
    const vendorNameLower = vendor.name.toLowerCase();
    if (subjectLower.includes(vendorNameLower)) {
      if (!bestMatch || vendor.name.length > bestMatch.name.length) {
        bestMatch = vendor;
      }
    }
  }

  return bestMatch;
}

// Create bills from confirmation emails (auto-pay processing)
// Handles both direct vendor emails and payment processor emails (e.g., speedpay.com)
async function createBillsFromConfirmationEmails(daysBack = 14) {
  console.log('\n💳 Creating bills from confirmation emails...');

  // Get confirmation emails that aren't already linked (include emails with OR without vendor_id)
  const emailResult = await pool.query(`
    SELECT
      vc.id, vc.vendor_id, v.name as vendor_name,
      vc.subject, vc.body_snippet, vc.body_html, vc.received_at
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.direction = 'inbound'
      AND vc.received_at >= CURRENT_DATE - ($1::INTEGER)
      AND NOT EXISTS (
        SELECT 1 FROM payment_email_links pel WHERE pel.email_id = vc.id
      )
    ORDER BY vc.received_at DESC
    LIMIT 100
  `, [daysBack]);

  const emails = emailResult.rows;
  let billsCreated = 0;

  for (const email of emails) {
    // Only process confirmation emails (check subject, snippet, AND html body)
    if (!isConfirmationEmailText(email.subject, email.body_snippet, email.body_html)) {
      continue;
    }

    // Extract amount from email (check snippet first, then HTML body)
    const text = [email.subject, email.body_snippet].filter(Boolean).join(' ');
    let amount = extractAmountFromText(text);

    // If no amount found in snippet, try HTML body
    if (!amount && email.body_html) {
      amount = extractAmountFromText(email.body_html);
    }

    if (!amount) {
      continue; // Can't create bill without amount
    }

    // Determine vendor - use existing vendor_id or try to find from subject
    let vendorId = email.vendor_id;
    let vendorName = email.vendor_name;

    if (!vendorId) {
      // Try to find vendor from subject line (for payment processor emails)
      const matchedVendor = await findVendorFromSubject(email.subject);
      if (matchedVendor) {
        vendorId = matchedVendor.id;
        vendorName = matchedVendor.name;
        console.log(`   📧 Found vendor "${vendorName}" from subject: ${email.subject?.substring(0, 50)}...`);
      } else {
        continue; // Can't create bill without identifying vendor
      }
    }

    // Generate description from subject
    let description = email.subject || `Payment to ${vendorName}`;
    // Clean up common prefixes
    description = description
      .replace(/^(Payment\s*[-–]\s*)/i, '')
      .replace(/^(Your payment has been received)\s*[-–]?\s*/i, '')
      .replace(/^(Payment confirmation:?\s*)/i, '')
      .trim();

    // If description is generic, use vendor name
    if (description.toLowerCase() === 'your payment has been received' ||
        description.toLowerCase().includes('autopay payment confirmation')) {
      description = `${vendorName} - Auto Pay`;
    }

    // Create the bill
    const billResult = await pool.query(`
      INSERT INTO bills (
        vendor_id,
        amount,
        due_date,
        payment_date,
        confirmation_date,
        description,
        status,
        payment_method,
        bill_type
      ) VALUES (
        $1, $2, $3::date, $3::date, $3::date, $4, 'confirmed', 'auto_pay', 'other'
      )
      RETURNING id
    `, [
      vendorId,
      amount,
      email.received_at.split('T')[0],
      description
    ]);

    if (billResult.rows.length > 0) {
      // Link the email to the new bill
      await pool.query(`
        INSERT INTO payment_email_links (payment_type, payment_id, email_id, link_type, confidence, auto_matched)
        VALUES ('bill', $1, $2, 'confirmation', 1.0, true)
        ON CONFLICT (payment_type, payment_id, email_id) DO NOTHING
      `, [billResult.rows[0].id, email.id]);

      console.log(`   ✓ Created bill: ${description} ($${amount})`);
      billsCreated++;
    }
  }

  console.log(`   Created ${billsCreated} bills from emails`);
  return billsCreated;
}

// Auto-match confirmation emails to auto-pay bills
async function autoMatchEmailsToPayments(daysBack = 14) {
  console.log('\n📎 Matching confirmation emails to auto-pay bills...');

  // Get recent vendor emails that aren't already linked
  const emailResult = await pool.query(`
    SELECT
      vc.id, vc.vendor_id, v.name as vendor_name,
      vc.subject, vc.body_snippet, vc.received_at
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.direction = 'inbound'
      AND vc.received_at >= CURRENT_DATE - ($1::INTEGER)
      AND NOT EXISTS (
        SELECT 1 FROM payment_email_links pel WHERE pel.email_id = vc.id
      )
    ORDER BY vc.received_at DESC
    LIMIT 200
  `, [daysBack]);

  const emails = emailResult.rows;

  // Get auto-pay bills that could be matched
  const billResult = await pool.query(`
    SELECT id, vendor_id, amount, due_date, description
    FROM bills
    WHERE due_date >= CURRENT_DATE - ($1::INTEGER)
      AND payment_method = 'auto_pay'
      AND status IN ('confirmed', 'sent', 'pending')
  `, [daysBack + 30]);

  const bills = billResult.rows;

  let linksCreated = 0;

  for (const email of emails) {
    if (!isConfirmationEmailText(email.subject, email.body_snippet)) {
      continue;
    }

    // Find best matching bill
    let bestMatch = null;

    for (const bill of bills) {
      let score = 0;

      // Vendor match (high weight)
      if (email.vendor_id && email.vendor_id === bill.vendor_id) {
        score += 0.4;
      }

      // Amount match
      const emailAmount = extractAmountFromText([email.subject, email.body_snippet].filter(Boolean).join(' '));
      if (emailAmount && Math.abs(emailAmount - parseFloat(bill.amount)) < 0.01) {
        score += 0.4;
      } else if (emailAmount && Math.abs(emailAmount - parseFloat(bill.amount)) < 1.00) {
        score += 0.2;
      }

      // Date proximity
      const emailDate = new Date(email.received_at);
      const billDate = new Date(bill.due_date);
      const daysDiff = Math.abs((emailDate.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 3) {
        score += 0.2;
      } else if (daysDiff <= 7) {
        score += 0.1;
      }

      if (score >= 0.7) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { bill, score };
        }
      }
    }

    if (bestMatch) {
      await pool.query(`
        INSERT INTO payment_email_links (payment_type, payment_id, email_id, link_type, confidence, auto_matched)
        VALUES ('bill', $1, $2, 'confirmation', $3, true)
        ON CONFLICT (payment_type, payment_id, email_id) DO NOTHING
      `, [bestMatch.bill.id, email.id, bestMatch.score]);

      console.log(`   ✓ Linked: "${email.subject?.substring(0, 40)}..." → ${bestMatch.bill.description}`);
      linksCreated++;
    }
  }

  console.log(`   Created ${linksCreated} email links`);
  return linksCreated;
}

// Match email to vendor
async function matchEmailToVendor(senderEmail, senderName, vendors) {
  const senderEmailLower = senderEmail.toLowerCase();
  const senderDomain = extractDomain(senderEmailLower);

  // Common/public email providers - emails from these domains should not match vendors by domain
  const commonDomains = new Set([
    // Major providers
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.ca',
    'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'live.com', 'msn.com',
    'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aol.co.uk',
    // ISP providers
    'comcast.net', 'xfinity.com', 'verizon.net', 'att.net', 'sbcglobal.net',
    'cox.net', 'charter.net', 'spectrum.net', 'frontier.com', 'centurylink.net',
    'earthlink.net', 'windstream.net', 'optimum.net', 'optonline.net',
    // Other common providers
    'protonmail.com', 'proton.me', 'tutanota.com', 'zoho.com',
    'ymail.com', 'rocketmail.com', 'mail.com', 'email.com',
    'usa.com', 'post.com', 'inbox.com', 'gmx.com', 'gmx.net',
    // International
    'mail.ru', 'yandex.com', 'qq.com', '163.com', '126.com',
    'web.de', 'freenet.de', 't-online.de', 'orange.fr', 'wanadoo.fr',
    'libero.it', 'virgilio.it', 'btinternet.com', 'sky.com', 'talktalk.net',
    // Educational (often personal accounts)
    'edu', 'ac.uk',
  ]);

  // Exact match
  for (const vendor of vendors) {
    const vendorEmails = parseVendorEmails(vendor.email);
    if (vendorEmails.includes(senderEmailLower)) {
      return { vendorId: vendor.id, vendorName: vendor.name, matchType: 'exact' };
    }
  }

  // Domain match (including subdomain matching)
  const senderRootDomain = extractRootDomain(senderDomain);
  if (senderDomain && !commonDomains.has(senderDomain) && !commonDomains.has(senderRootDomain)) {
    for (const vendor of vendors) {
      const vendorEmails = parseVendorEmails(vendor.email);
      for (const vendorEmail of vendorEmails) {
        const vendorDomain = extractDomain(vendorEmail);
        const vendorRootDomain = extractRootDomain(vendorDomain);
        // Match exact domain or root domain
        if (vendorDomain === senderDomain || vendorRootDomain === senderRootDomain) {
          return { vendorId: vendor.id, vendorName: vendor.name, matchType: 'domain' };
        }
      }
    }
  }

  // No match - only exact email and domain matches are allowed
  // Name matching disabled to prevent false positives (e.g., "Matt" in sender name matching FlueTech)
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
      process.env.GOOGLE_CLIENT_ID || envVars.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET || envVars.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || envVars.GOOGLE_REDIRECT_URI
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

    // Create bills from confirmation emails (auto-pay processing)
    let billsFromEmails = 0;
    try {
      billsFromEmails = await createBillsFromConfirmationEmails(14);
    } catch (billError) {
      console.error('   Error creating bills from emails:', billError.message);
    }

    // Auto-match confirmation emails to existing bills
    let emailLinks = 0;
    try {
      emailLinks = await autoMatchEmailsToPayments(14);
    } catch (linkError) {
      console.error('   Error matching email links:', linkError.message);
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  SYNC COMPLETE`);
    console.log(`  Stored: ${stored} | Matched: ${matched} | Urgent: ${urgent}`);
    console.log(`  Bills from emails: ${billsFromEmails} | Links: ${emailLinks}`);
    console.log(`${'─'.repeat(60)}\n`);

    return { success: true, emailsStored: stored, emailsMatched: matched, urgentEmails: urgent, emailLinks };

  } catch (error) {
    const errMsg = error.message || error.toString() || 'Unknown error';
    console.error('\n❌ Sync error:', errMsg);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    if (error.errors) {
      console.error('Errors:', error.errors);
    }
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
