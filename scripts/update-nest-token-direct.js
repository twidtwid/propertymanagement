#!/usr/bin/env node

// Direct token update script - paste token as argument
const crypto = require('crypto');
const { Pool } = require('pg');

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!TOKEN_ENCRYPTION_KEY || !DATABASE_URL) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const newToken = process.argv[2];
if (!newToken) {
  console.error('Usage: node update-nest-token-direct.js <token>');
  process.exit(1);
}

console.log(`Token length: ${newToken.length} characters`);

function encryptToken(token) {
  const keyBuffer = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  const IV_LENGTH = 16;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(token, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag (matches src/lib/encryption.ts)
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

async function updateToken() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newCreds = {
      access_token: newToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };

    const encryptedCreds = encryptToken(JSON.stringify(newCreds));

    const result = await pool.query(
      `UPDATE camera_credentials
       SET credentials_encrypted = $1,
           updated_at = NOW()
       WHERE provider = $2
       RETURNING id`,
      [encryptedCreds, 'nest_legacy']
    );

    if (result.rowCount === 0) {
      console.error('No nest_legacy credentials found to update');
      process.exit(1);
    }

    console.log(`✓ Token updated successfully`);
    console.log(`  Expires: ${expiresAt.toISOString()}`);
    console.log(`  Token preview: ${newToken.substring(0, 50)}...`);

  } catch (error) {
    console.error('Error updating token:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateToken();
