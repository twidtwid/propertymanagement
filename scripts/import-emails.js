#!/usr/bin/env node
/**
 * Historical Email Import Script
 * Imports emails from a specific date range.
 *
 * Usage:
 *   node scripts/import-emails.js --start=2025-01-01 --end=2025-12-31
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

const DATABASE_URL = process.env.DATABASE_URL || envVars.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/propertymanagement';
const pool = new Pool({ connectionString: DATABASE_URL });

console.log('Using database:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

// Decryption
function decryptToken(encryptedBase64) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || envVars.TOKEN_ENCRYPTION_KEY, 'hex');
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

function parseVendorEmails(emailField) {
  if (!emailField) return [];
  return emailField.split(/[,;]/).map(e => e.trim().toLowerCase()).filter(e => e.length > 0 && e.includes('@'));
}

function extractDomain(email) {
  const match = email.toLowerCase().match(/@([^@]+)$/);
  return match ? match[1] : null;
}

function extractRootDomain(domain) {
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

const commonDomains = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'comcast.net', 'verizon.net'
]);

function matchEmailToVendor(senderEmail, senderName, vendors) {
  const senderEmailLower = senderEmail.toLowerCase();
  const senderDomain = extractDomain(senderEmailLower);
  const senderRootDomain = extractRootDomain(senderDomain);

  // Exact match
  for (const vendor of vendors) {
    const vendorEmails = parseVendorEmails(vendor.email);
    if (vendorEmails.includes(senderEmailLower)) {
      return { vendorId: vendor.id, vendorName: vendor.name, matchType: 'exact' };
    }
  }

  // Domain match (including subdomain matching)
  if (senderDomain && !commonDomains.has(senderDomain) && !commonDomains.has(senderRootDomain)) {
    for (const vendor of vendors) {
      const vendorEmails = parseVendorEmails(vendor.email);
      for (const vendorEmail of vendorEmails) {
        const vendorDomain = extractDomain(vendorEmail);
        const vendorRootDomain = extractRootDomain(vendorDomain);
        if (vendorDomain === senderDomain || vendorRootDomain === senderRootDomain) {
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

function isUrgentEmail(subject, snippet) {
  const urgentKeywords = ['urgent', 'emergency', 'immediate', 'asap', 'critical', 'time-sensitive', 'action required', 'important'];
  const text = ((subject || '') + ' ' + (snippet || '')).toLowerCase();
  return urgentKeywords.some(kw => text.includes(kw));
}

async function emailExists(gmailMessageId) {
  const result = await pool.query('SELECT 1 FROM vendor_communications WHERE gmail_message_id = $1 LIMIT 1', [gmailMessageId]);
  return result.rows.length > 0;
}

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
      vendorId, email.messageId, email.threadId, direction,
      email.from, email.to, email.subject, email.snippet, email.bodyHtml,
      email.receivedAt, false, isImportant, email.hasAttachments,
      email.attachmentNames || [], email.labels || []
    ]);
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('  Error storing email:', error.message);
    return null;
  }
}

function parseMessage(message) {
  const headers = message.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const fromRaw = getHeader('From');
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
  const fromEmail = fromMatch ? fromMatch[2] : fromRaw;
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : null;
  const toRaw = getHeader('To');

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

async function importEmails(startDate, endDate) {
  const userEmail = process.env.NOTIFICATION_EMAIL || envVars.NOTIFICATION_EMAIL || 'anne@annespalter.com';
  const timestamp = new Date().toISOString();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  EMAIL IMPORT - ${timestamp}`);
  console.log(`  Range: ${startDate} to ${endDate}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Get OAuth tokens
    const tokenResult = await pool.query('SELECT * FROM gmail_oauth_tokens WHERE user_email = $1', [userEmail]);

    if (tokenResult.rows.length === 0) {
      console.log('❌ No Gmail tokens found. Please connect Gmail first.');
      return { success: false, error: 'No tokens' };
    }

    const tokenRow = tokenResult.rows[0];
    const accessToken = decryptToken(tokenRow.access_token_encrypted);
    const refreshToken = decryptToken(tokenRow.refresh_token_encrypted);

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

    const query = `after:${startDate.replace(/-/g, '/')} before:${endDate.replace(/-/g, '/')}`;
    console.log(`📧 Fetching emails: ${query}`);

    const vendors = await getActiveVendors();
    console.log(`   ${vendors.length} active vendors for matching`);

    let stored = 0;
    let matched = 0;
    let urgent = 0;
    let pageToken = null;
    let totalProcessed = 0;
    let page = 0;

    do {
      page++;
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
        pageToken: pageToken
      });

      const messages = response.data.messages || [];
      pageToken = response.data.nextPageToken;

      console.log(`\n   Page ${page}: ${messages.length} messages (${pageToken ? 'more pages' : 'last page'})`);

      for (const msg of messages) {
        totalProcessed++;

        if (await emailExists(msg.id)) {
          continue;
        }

        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          const parsed = parseMessage(detail.data);
          const match = matchEmailToVendor(parsed.from, parsed.fromName, vendors);
          const direction = parsed.from.toLowerCase() === userEmail.toLowerCase() ? 'outbound' : 'inbound';
          const isImportant = isUrgentEmail(parsed.subject, parsed.snippet);

          if (match.vendorId) matched++;
          if (isImportant) urgent++;

          const id = await storeEmail(parsed, match.vendorId, direction, isImportant);
          if (id) {
            stored++;
            if (stored % 50 === 0) {
              console.log(`   Stored ${stored} emails so far...`);
            }
          }
        } catch (error) {
          console.error(`   ✗ Error processing ${msg.id}: ${error.message}`);
        }

        // Rate limiting
        if (totalProcessed % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

    } while (pageToken);

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  IMPORT COMPLETE`);
    console.log(`  Total processed: ${totalProcessed}`);
    console.log(`  Stored: ${stored} | Matched: ${matched} | Urgent: ${urgent}`);
    console.log(`${'─'.repeat(60)}\n`);

    return { success: true, totalProcessed, emailsStored: stored, emailsMatched: matched, urgentEmails: urgent };

  } catch (error) {
    const errMsg = error.message || error.toString() || 'Unknown error';
    console.error('\n❌ Import error:', errMsg);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    return { success: false, error: errMsg };
  }
}

// Parse args
const args = process.argv.slice(2);
const startArg = args.find(a => a.startsWith('--start='));
const endArg = args.find(a => a.startsWith('--end='));

const startDate = startArg ? startArg.split('=')[1] : '2025-01-01';
const endDate = endArg ? endArg.split('=')[1] : new Date().toISOString().split('T')[0];

importEmails(startDate, endDate).then(() => {
  pool.end();
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
