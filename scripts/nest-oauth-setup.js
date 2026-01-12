#!/usr/bin/env node
/**
 * Nest OAuth Setup Helper
 *
 * Run this script to:
 * 1. Generate the OAuth authorization URL
 * 2. Exchange the authorization code for tokens
 * 3. Store encrypted tokens in the database
 */

const { execSync } = require('child_process');
const readline = require('readline');
const https = require('https');
const crypto = require('crypto');
const { Client } = require('pg');

// Load environment
require('dotenv').config({ path: '.env.local' });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PROJECT_ID = process.env.NEST_PROJECT_ID;
const REDIRECT_URI = 'http://localhost:3000/api/auth/nest/callback';
const DATABASE_URL = process.env.DATABASE_URL;

if (!CLIENT_ID || !CLIENT_SECRET || !PROJECT_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEST_PROJECT_ID');
  process.exit(1);
}

const SCOPES = [
  'https://www.googleapis.com/auth/sdm.service',
].join(' ');

// Encryption functions (matching server-side)
function encrypt(text) {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  const iv = crypto.randomBytes(12);
  const keyBuffer = Buffer.from(key, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

async function step1_generateAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    access_type: 'offline',
    response_type: 'code',
    scope: SCOPES,
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  console.log('\n' + '='.repeat(70));
  console.log('STEP 1: Authorize Access');
  console.log('='.repeat(70));
  console.log('\nVisit this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n1. Sign in with the Google account that owns your Nest cameras');
  console.log('2. Grant access to Smart Device Management');
  console.log('3. You\'ll be redirected to localhost:3000 (it will show an error - that\'s OK!)');
  console.log('4. Copy the FULL URL from your browser address bar');
  console.log('\nPress Enter when ready to continue...');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

async function step2_getAuthCode() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 2: Enter Authorization Code');
  console.log('='.repeat(70));
  console.log('\nPaste the FULL callback URL from your browser:');
  console.log('(It should start with http://localhost:3000/api/auth/nest/callback?code=...)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('URL: ', (url) => {
      rl.close();
      const match = url.match(/code=([^&]+)/);
      if (!match) {
        console.error('❌ Could not find authorization code in URL');
        process.exit(1);
      }
      resolve(match[1]);
    });
  });
}

async function step3_exchangeToken(code) {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 3: Exchange Code for Tokens');
  console.log('='.repeat(70));

  const params = new URLSearchParams({
    code: decodeURIComponent(code),
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': params.toString().length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error('❌ Token exchange failed:', data);
            reject(new Error(data));
            return;
          }
          resolve(JSON.parse(data));
        });
      }
    );

    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

async function step4_storeTokens(tokens) {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 4: Store Encrypted Tokens');
  console.log('='.repeat(70));

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const credentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };

  const encrypted = encrypt(JSON.stringify(credentials));

  await client.query(
    `INSERT INTO camera_credentials (provider, credentials_encrypted)
     VALUES ('nest', $1)
     ON CONFLICT (provider) WHERE property_id IS NULL
     DO UPDATE SET credentials_encrypted = $1, updated_at = NOW()`,
    [encrypted]
  );

  await client.end();

  console.log('✓ Tokens stored successfully in database (encrypted)');
}

async function main() {
  console.clear();
  console.log('\n' + '='.repeat(70));
  console.log('           NEST CAMERA OAUTH SETUP');
  console.log('='.repeat(70));
  console.log('\nProject ID:', PROJECT_ID);
  console.log('Redirect URI:', REDIRECT_URI);

  try {
    await step1_generateAuthUrl();
    const code = await step2_getAuthCode();
    const tokens = await step3_exchangeToken(code);
    await step4_storeTokens(tokens);

    console.log('\n' + '='.repeat(70));
    console.log('✓ SETUP COMPLETE!');
    console.log('='.repeat(70));
    console.log('\nNext steps:');
    console.log('1. Run: node scripts/nest-discover-cameras.js');
    console.log('2. Visit: http://localhost:3000/cameras');
    console.log('='.repeat(70) + '\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
