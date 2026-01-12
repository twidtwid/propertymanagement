#!/usr/bin/env node
/**
 * Setup Nest Legacy Refresh Authentication
 *
 * This replaces the manual token refresh with automatic refresh using issue_token + cookies.
 * Only needs to be run once when setting up, or when Google session expires.
 *
 * How to get credentials:
 * 1. Open https://home.nest.com in Chrome
 * 2. Log in with your Google account
 * 3. Open DevTools (F12) → Network tab
 * 4. Filter for "issueToken" in the network tab
 * 5. Refresh the page or navigate around until you see "iframerpc" requests
 * 6. Click on an "iframerpc" request → Copy the full Request URL (this is issue_token)
 * 7. In the same request, go to Headers → Find "Cookie" → Copy the entire cookie value
 * 8. Run: npm run nest:setup-refresh <issue_token_url> <cookies>
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envVars = {};
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envVars[match[1]] = match[2];
  });
}

const DATABASE_URL = process.env.DATABASE_URL || envVars.DATABASE_URL;
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || envVars.TOKEN_ENCRYPTION_KEY;

function encryptToken(plaintext) {
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

async function testIssueToken(issueToken, cookies) {
  return new Promise((resolve, reject) => {
    const url = new URL(issueToken);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Sec-Fetch-Mode': 'cors',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'X-Requested-With': 'XmlHttpRequest',
        'Referer': 'https://accounts.google.com/o/oauth2/iframe',
        'cookie': cookies
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const json = JSON.parse(data);
          if (data.includes('USER_LOGGED_OUT')) {
            reject(new Error('Google session expired - log in to home.nest.com'));
            return;
          }
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error('No access_token in response'));
          }
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function setupRefreshAuth(issueToken, cookies) {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('Testing issue_token + cookies...');
    const googleAccessToken = await testIssueToken(issueToken, cookies);
    console.log('✓ Successfully obtained Google access token');
    console.log('  Token prefix:', googleAccessToken.substring(0, 30) + '...');

    // Store issue_token + cookies (these are long-lived)
    const credentials = {
      issue_token: issueToken,
      cookies: cookies,
      setup_at: new Date().toISOString()
    };

    const encrypted = encryptToken(JSON.stringify(credentials));

    // Update database
    const result = await pool.query(`
      UPDATE camera_credentials
      SET credentials_encrypted = $1, updated_at = NOW()
      WHERE provider = 'nest_legacy'
    `, [encrypted]);

    if (result.rowCount === 0) {
      throw new Error('No nest_legacy credentials found in database');
    }

    console.log('✓ Credentials updated successfully');
    console.log('\nSetup complete! Your Nest Legacy cameras will now:');
    console.log('  • Automatically refresh JWT every 55 minutes');
    console.log('  • Work indefinitely as long as you stay logged into Google');
    console.log('  • No manual token updates required');
    console.log('\nNote: If you log out of home.nest.com, you\'ll need to run this setup again.');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get credentials from command line
const issueToken = process.argv[2];
const cookies = process.argv[3];

if (!issueToken || !cookies) {
  console.error('Usage: npm run nest:setup-refresh <issue_token_url> <cookies>');
  console.error('\nHow to get credentials:');
  console.error('1. Open https://home.nest.com in Chrome');
  console.error('2. Open DevTools (F12) → Network tab');
  console.error('3. Filter for "issueToken"');
  console.error('4. Look for "iframerpc" requests');
  console.error('5. Copy the full Request URL (issue_token)');
  console.error('6. Copy the Cookie header value (cookies)');
  console.error('\nExample:');
  console.error('  npm run nest:setup-refresh \\');
  console.error('    "https://accounts.google.com/o/oauth2/iframerpc?..." \\');
  console.error('    "SIDCC=...; SSID=...; ..."');
  process.exit(1);
}

// Run setup
setupRefreshAuth(issueToken, cookies);
