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

async function searchGmail(query) {
  const userEmail = envVars.NOTIFICATION_EMAIL || 'anne@annespalter.com';

  console.log(`\n🔍 Searching Gmail for: "${query}"\n`);

  try {
    const tokenResult = await pool.query(
      'SELECT * FROM gmail_oauth_tokens WHERE user_email = $1',
      [userEmail]
    );

    if (tokenResult.rows.length === 0) {
      console.error('❌ No Gmail tokens found.');
      process.exit(1);
    }

    const tokenRow = tokenResult.rows[0];
    const accessToken = decryptToken(tokenRow.access_token_encrypted);
    const refreshToken = decryptToken(tokenRow.refresh_token_encrypted);

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

    // Search for messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });

    const messages = response.data.messages || [];
    console.log(`Found ${messages.length} messages\n`);

    if (messages.length === 0) {
      console.log('No messages found.');
      return [];
    }

    // Get details of each message
    const results = [];
    for (const msg of messages.slice(0, 20)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date']
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

      results.push({
        from: getHeader('From'),
        subject: getHeader('Subject'),
        date: getHeader('Date')
      });

      console.log(`📧 ${getHeader('Date')}`);
      console.log(`   From: ${getHeader('From')}`);
      console.log(`   Subject: ${getHeader('Subject')}`);
      console.log();
    }

    return results;

  } catch (err) {
    console.error('Error:', err.message);
    return [];
  } finally {
    await pool.end();
  }
}

// Search for various vendor-related terms
async function main() {
  const userEmail = envVars.NOTIFICATION_EMAIL || 'anne@annespalter.com';

  console.log('=' .repeat(60));
  console.log('  GMAIL VENDOR SEARCH');
  console.log('=' .repeat(60));

  try {
    const tokenResult = await pool.query(
      'SELECT * FROM gmail_oauth_tokens WHERE user_email = $1',
      [userEmail]
    );

    if (tokenResult.rows.length === 0) {
      console.error('❌ No Gmail tokens found.');
      process.exit(1);
    }

    const tokenRow = tokenResult.rows[0];
    const accessToken = decryptToken(tokenRow.access_token_encrypted);
    const refreshToken = decryptToken(tokenRow.refresh_token_encrypted);

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

    // Search for shl-ny.com domain (the A/V vendor found)
    console.log('\n🔍 Searching for shl-ny.com emails (A/V vendor)...\n');

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:shl-ny.com after:2024/01/01',
      maxResults: 100
    });

    const messages = response.data.messages || [];
    console.log(`Found ${messages.length} messages from shl-ny.com\n`);

    const senders = new Map();
    const subjects = [];

    for (const msg of messages.slice(0, 50)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date']
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name === name)?.value || '';
      const from = getHeader('From');
      const subject = getHeader('Subject');

      // Track unique senders
      const emailMatch = from.match(/<([^>]+)>/) || [null, from];
      const email = emailMatch[1];
      if (!senders.has(email)) {
        senders.set(email, { email, name: from.replace(/<[^>]+>/, '').trim().replace(/"/g, ''), count: 0 });
      }
      senders.get(email).count++;

      subjects.push(subject);
    }

    console.log('Unique senders from shl-ny.com:');
    for (const [email, info] of senders) {
      console.log(`  ${info.count}x ${email} (${info.name})`);
    }

    console.log('\nSample subjects:');
    [...new Set(subjects)].slice(0, 15).forEach(s => console.log(`  - ${s}`));

    // Also search for other potential vendors
    const vendorSearches = [
      { query: 'from:parkercci.com', name: 'Parker Construction' },
      { query: 'from:fluetechinc.com', name: 'Flue Tech' },
      { query: 'from:allenpools-spas.com', name: 'Allen Pools' },
      { query: 'from:forestcarevt', name: 'Forest Care VT' },
    ];

    console.log('\n' + '='.repeat(60));
    console.log('Existing vendor email counts:');
    console.log('='.repeat(60));

    for (const search of vendorSearches) {
      const resp = await gmail.users.messages.list({
        userId: 'me',
        q: `${search.query} after:2024/01/01`,
        maxResults: 500
      });
      const count = resp.data.messages?.length || 0;
      console.log(`  ${search.name}: ${count} emails`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
