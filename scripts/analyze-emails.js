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

const pool = new Pool({ connectionString: envVars.DATABASE_URL });

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

async function main() {
  const userEmail = envVars.NOTIFICATION_EMAIL || 'anne@annespalter.com';

  console.log('📧 Gmail Email Analysis - 2025');
  console.log('================================\n');

  try {
    // Get tokens from database
    const tokenResult = await pool.query(
      'SELECT * FROM gmail_oauth_tokens WHERE user_email = $1',
      [userEmail]
    );

    if (tokenResult.rows.length === 0) {
      console.error('❌ No Gmail tokens found. Please connect Gmail first.');
      process.exit(1);
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

    // Fetch all 2025 emails
    console.log('🔍 Fetching 2025 emails...\n');

    const allMessages = [];
    let pageToken = null;
    let page = 0;

    do {
      page++;
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: 'after:2025/01/01 before:2025/12/31',
        maxResults: 500,
        pageToken: pageToken
      });

      if (response.data.messages) {
        allMessages.push(...response.data.messages);
        process.stdout.write(`\r  Found ${allMessages.length} messages (page ${page})...`);
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`\n\n✅ Total messages found: ${allMessages.length}\n`);

    if (allMessages.length === 0) {
      console.log('No emails found for 2025.');
      process.exit(0);
    }

    // Fetch message details in batches
    console.log('📥 Fetching message details...\n');

    const emails = [];
    const batchSize = 50;

    for (let i = 0; i < allMessages.length; i += batchSize) {
      const batch = allMessages.slice(i, i + batchSize);
      const promises = batch.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          });
          return detail.data;
        } catch (e) {
          return null;
        }
      });

      const results = await Promise.all(promises);
      emails.push(...results.filter(r => r !== null));

      process.stdout.write(`\r  Processed ${Math.min(i + batchSize, allMessages.length)}/${allMessages.length} messages...`);

      // Small delay to avoid rate limiting
      if (i + batchSize < allMessages.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log('\n\n');

    // Analyze emails
    const senderMap = new Map();
    const subjectPatterns = {
      invoice: 0,
      payment: 0,
      service: 0,
      urgent: 0,
      quote: 0,
      confirmation: 0,
      scheduled: 0,
      renewal: 0
    };

    for (const email of emails) {
      const headers = email.payload?.headers || [];
      const fromHeader = headers.find(h => h.name === 'From');
      const subjectHeader = headers.find(h => h.name === 'Subject');

      if (fromHeader) {
        // Parse email address
        const fromValue = fromHeader.value;
        const emailMatch = fromValue.match(/<([^>]+)>/) || [null, fromValue];
        const senderEmail = (emailMatch[1] || fromValue).toLowerCase().trim();
        const nameMatch = fromValue.match(/^([^<]+)</);
        const senderName = nameMatch ? nameMatch[1].trim().replace(/"/g, '') : null;

        const existing = senderMap.get(senderEmail);
        if (existing) {
          existing.count++;
        } else {
          senderMap.set(senderEmail, { email: senderEmail, name: senderName, count: 1 });
        }
      }

      // Check subject patterns
      if (subjectHeader) {
        const subject = subjectHeader.value.toLowerCase();
        if (subject.includes('invoice') || subject.includes('bill') || subject.includes('statement')) subjectPatterns.invoice++;
        if (subject.includes('payment') || subject.includes('paid') || subject.includes('receipt')) subjectPatterns.payment++;
        if (subject.includes('service') || subject.includes('repair') || subject.includes('maintenance')) subjectPatterns.service++;
        if (subject.includes('urgent') || subject.includes('emergency') || subject.includes('immediate')) subjectPatterns.urgent++;
        if (subject.includes('quote') || subject.includes('estimate') || subject.includes('proposal')) subjectPatterns.quote++;
        if (subject.includes('confirm') || subject.includes('confirmed')) subjectPatterns.confirmation++;
        if (subject.includes('scheduled') || subject.includes('appointment')) subjectPatterns.scheduled++;
        if (subject.includes('renew') || subject.includes('expir')) subjectPatterns.renewal++;
      }
    }

    // Get existing vendors
    const vendorResult = await pool.query('SELECT id, name, email, specialty FROM vendors ORDER BY name');
    const vendors = vendorResult.rows;
    const vendorEmails = new Set();
    vendors.forEach(v => {
      if (v.email) {
        v.email.split(/[,;]/).forEach(e => vendorEmails.add(e.trim().toLowerCase()));
      }
    });

    // Sort senders by count
    const topSenders = Array.from(senderMap.values())
      .sort((a, b) => b.count - a.count);

    // Match to vendors and find unmatched
    const matchedSenders = [];
    const unmatchedSenders = [];

    for (const sender of topSenders) {
      const isVendor = vendorEmails.has(sender.email);
      if (isVendor) {
        const vendor = vendors.find(v => v.email && v.email.toLowerCase().includes(sender.email));
        matchedSenders.push({ ...sender, vendor: vendor?.name });
      } else if (sender.count >= 2) {
        unmatchedSenders.push(sender);
      }
    }

    // Output report
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    EMAIL ANALYSIS REPORT - 2025');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📊 VOLUME SUMMARY');
    console.log('─────────────────');
    console.log(`  Total emails analyzed: ${emails.length}`);
    console.log(`  Unique senders: ${senderMap.size}`);
    console.log(`  Date range: 2025-01-01 to 2025-12-31\n`);

    console.log('📈 EMAIL PATTERNS DETECTED');
    console.log('──────────────────────────');
    Object.entries(subjectPatterns)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pattern, count]) => {
        console.log(`  ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}: ${count} emails`);
      });

    console.log('\n✅ MATCHED VENDORS (in database)');
    console.log('─────────────────────────────────');
    matchedSenders.slice(0, 15).forEach(s => {
      console.log(`  ${s.count.toString().padStart(4)}x  ${s.email.padEnd(40)} → ${s.vendor}`);
    });

    console.log('\n⚠️  UNMATCHED FREQUENT SENDERS (potential vendors to add)');
    console.log('──────────────────────────────────────────────────────────');
    unmatchedSenders.slice(0, 30).forEach(s => {
      console.log(`  ${s.count.toString().padStart(4)}x  ${s.email.padEnd(45)} ${s.name || ''}`);
    });

    console.log('\n📋 TOP 50 SENDERS (all)');
    console.log('───────────────────────');
    topSenders.slice(0, 50).forEach((s, i) => {
      const isVendor = vendorEmails.has(s.email);
      const marker = isVendor ? '✓' : ' ';
      console.log(`  ${(i+1).toString().padStart(2)}. ${marker} ${s.count.toString().padStart(4)}x  ${s.email.padEnd(45)} ${s.name || ''}`);
    });

    // Save full report to file
    const reportPath = path.join(__dirname, '..', 'email-analysis-2025.json');
    const report = {
      analyzedAt: new Date().toISOString(),
      totalEmails: emails.length,
      uniqueSenders: senderMap.size,
      patterns: subjectPatterns,
      matchedVendors: matchedSenders,
      unmatchedSenders: unmatchedSenders.slice(0, 100),
      topSenders: topSenders.slice(0, 100)
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n\n💾 Full report saved to: email-analysis-2025.json`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
