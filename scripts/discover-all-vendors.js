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

  console.log('=' .repeat(70));
  console.log('  COMPREHENSIVE VENDOR DISCOVERY FROM GMAIL');
  console.log('=' .repeat(70));

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

    // Get existing vendors from database
    const vendorResult = await pool.query('SELECT name, email, specialty FROM vendors ORDER BY name');
    const existingVendors = new Set();
    vendorResult.rows.forEach(v => {
      if (v.email) {
        v.email.split(/[,;]/).forEach(e => existingVendors.add(e.trim().toLowerCase()));
      }
    });
    console.log(`\nExisting vendors in database: ${vendorResult.rows.length}`);

    // Search for potential vendor-related emails
    const searches = [
      { query: 'subject:invoice OR subject:receipt', category: 'Invoice/Billing' },
      { query: 'subject:quote OR subject:estimate', category: 'Quotes/Estimates' },
      { query: 'subject:scheduled OR subject:appointment', category: 'Appointments' },
      { query: 'subject:service OR subject:maintenance', category: 'Service' },
      { query: 'subject:repair', category: 'Repairs' },
      { query: 'from:@nationalgrid OR from:@eversource OR from:@ngrid', category: 'Utilities' },
      { query: 'subject:insurance OR subject:policy', category: 'Insurance' },
    ];

    const discoveredDomains = new Map();

    for (const search of searches) {
      console.log(`\n📧 Searching: ${search.category}...`);

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: `${search.query} after:2024/01/01`,
        maxResults: 100
      });

      const messages = response.data.messages || [];
      console.log(`   Found ${messages.length} messages`);

      for (const msg of messages.slice(0, 30)) {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From']
          });

          const headers = detail.data.payload?.headers || [];
          const from = headers.find(h => h.name === 'From')?.value || '';

          // Extract email domain
          const emailMatch = from.match(/<([^>]+)>/) || [null, from];
          const email = (emailMatch[1] || from).toLowerCase().trim();
          const domainMatch = email.match(/@([^@]+)$/);
          const domain = domainMatch ? domainMatch[1] : null;

          if (domain && !existingVendors.has(email)) {
            // Skip common non-vendor domains
            const skipDomains = [
              'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
              'amazon.com', 'google.com', 'facebook.com', 'twitter.com',
              'nytimes.com', 'bloomberg.com', 'wsj.com',
              'paypal.com', 'stripe.com', 'square.com',
              'bankofamerica.com', 'chase.com', 'wellsfargo.com',
              'nextdoor.com', 'reddit.com',
              'michaelspalter.com', 'annespalter.com'
            ];

            if (!skipDomains.some(sd => domain.includes(sd))) {
              if (!discoveredDomains.has(domain)) {
                discoveredDomains.set(domain, {
                  domain,
                  emails: new Set(),
                  names: new Set(),
                  categories: new Set(),
                  count: 0
                });
              }
              const info = discoveredDomains.get(domain);
              info.emails.add(email);
              info.names.add(from.replace(/<[^>]+>/, '').trim().replace(/"/g, ''));
              info.categories.add(search.category);
              info.count++;
            }
          }
        } catch (e) {
          // Skip errors for individual messages
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

    // Output discovered domains
    console.log('\n' + '='.repeat(70));
    console.log('  POTENTIAL NEW VENDORS DISCOVERED');
    console.log('='.repeat(70));

    const sortedDomains = Array.from(discoveredDomains.values())
      .sort((a, b) => b.count - a.count);

    for (const info of sortedDomains.slice(0, 50)) {
      const categories = Array.from(info.categories).join(', ');
      const names = Array.from(info.names).slice(0, 2).join('; ');
      const emails = Array.from(info.emails).slice(0, 2).join(', ');
      console.log(`\n  ${info.domain} (${info.count} matches)`);
      console.log(`    Categories: ${categories}`);
      console.log(`    Names: ${names}`);
      console.log(`    Emails: ${emails}`);
    }

    // Save results
    const outputPath = path.join(__dirname, '..', 'vendor-discovery-results.json');
    const output = sortedDomains.map(d => ({
      domain: d.domain,
      count: d.count,
      categories: Array.from(d.categories),
      names: Array.from(d.names),
      emails: Array.from(d.emails)
    }));
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n\n💾 Results saved to vendor-discovery-results.json`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
