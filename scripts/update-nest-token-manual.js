#!/usr/bin/env node
/**
 * Update Nest Legacy Token Manually
 *
 * Tests a new token against the Dropcam API and stores it encrypted in the database.
 * This is the production approach used by Home Assistant and Homebridge.
 *
 * Usage:
 *   npm run nest:update-token <new_token>
 *
 * Where <new_token> is the user_token cookie from home.nest.com
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

function decryptToken(encryptedBase64) {
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  const combined = Buffer.from(encryptedBase64, 'base64');
  const IV_LENGTH = 16;
  const TAG_LENGTH = 16;
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function testToken(token) {
  return new Promise((resolve, reject) => {
    // Test token against Dropcam API with a dummy UUID (will fail if token is invalid)
    const options = {
      hostname: 'nexusapi-us1.dropcam.com',
      path: '/get_image?uuid=test&width=1280',
      method: 'GET',
      headers: {
        Authorization: `Basic ${token}`,
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://home.nest.com/',
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        reject(new Error('Token is invalid (401/403)'));
      } else if (res.statusCode === 404) {
        // 404 is expected for dummy UUID - token is valid
        resolve(true);
      } else {
        resolve(true);
      }
    });

    req.on('error', reject);
    req.end();
  });
}

async function updateToken(newToken) {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('Testing new token...');
    await testToken(newToken);
    console.log('✓ Token is valid');

    // Get existing credentials to preserve structure
    const result = await pool.query(
      "SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest_legacy'"
    );

    let existingCreds = {};
    if (result.rows.length > 0) {
      try {
        existingCreds = JSON.parse(decryptToken(result.rows[0].credentials_encrypted));
      } catch (err) {
        console.log('Note: Could not decrypt existing credentials, creating new record');
      }
    }

    // Update credentials with new token and expiration (30 days from now)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const newCreds = {
      ...existingCreds,
      access_token: newToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };

    const encryptedCreds = encryptToken(JSON.stringify(newCreds));

    // Update existing credentials (don't use UPSERT since there's no unique constraint on provider)
    const updateResult = await pool.query(`
      UPDATE camera_credentials
      SET credentials_encrypted = $1, updated_at = NOW()
      WHERE provider = 'nest_legacy'
    `, [encryptedCreds]);

    if (updateResult.rowCount === 0) {
      throw new Error('No nest_legacy credentials found in database. Run migration first.');
    }

    console.log('✓ Token updated successfully');
    console.log(`Token expires: ${expiresAt.toISOString()}`);
    console.log(`Days until expiry: 30`);
    console.log('\nYour Nest Legacy cameras should now work!');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get token from command line
const newToken = process.argv[2];

if (!newToken) {
  console.error('Usage: npm run nest:update-token <new_token>');
  console.error('\nHow to get the token:');
  console.error('1. Open https://home.nest.com in your browser');
  console.error('2. Open DevTools (F12) → Application → Cookies');
  console.error('3. Copy the value of the "user_token" cookie');
  console.error('4. Run: npm run nest:update-token <paste_value_here>');
  process.exit(1);
}

// Run update
updateToken(newToken);
