#!/usr/bin/env node
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const CODE = process.argv[2];
const CLIENT_ID = process.env.NEST_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.NEST_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/api/auth/nest/callback';
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

function encrypt(text) {
  const IV_LENGTH = 16;
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Match app format: IV + encrypted + authTag as base64
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

async function exchangeToken() {
  const params = new URLSearchParams({
    code: CODE,
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
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error('Token exchange failed:', data);
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

async function main() {
  console.log('Exchanging authorization code for tokens...');

  const tokens = await exchangeToken();
  console.log('✓ Received tokens from Google');

  const credentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };

  const encrypted = encrypt(JSON.stringify(credentials));
  console.log('✓ Encrypted tokens');

  // Store in database
  const sql = `
    INSERT INTO camera_credentials (provider, credentials_encrypted)
    VALUES ('nest', '${encrypted}')
    ON CONFLICT ON CONSTRAINT camera_credentials_pkey
    DO UPDATE SET credentials_encrypted = EXCLUDED.credentials_encrypted, updated_at = NOW()
    RETURNING id;
  `;

  try {
    const result = execSync(
      `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${sql.replace(/\n/g, ' ')}"`,
      { encoding: 'utf8' }
    );
    console.log('✓ Tokens stored in database');
    console.log('\nSetup complete! Next steps:');
    console.log('1. Discover cameras: node scripts/nest-discover-cameras.js');
    console.log('2. View cameras: http://localhost:3000/cameras');
  } catch (error) {
    console.error('Failed to store tokens:', error.message);
    console.log('\nEncrypted credentials:', encrypted);
    console.log('\nManually run this SQL:');
    console.log(sql);
  }
}

main().catch(console.error);
