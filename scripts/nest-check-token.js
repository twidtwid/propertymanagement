#!/usr/bin/env node
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ENCRYPTION_KEY = '67eaf68c739d0a0b88efb1efad3a176a193f2c97aa2784c045eb55f9bdc07782';

function decrypt(encrypted) {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedData = parts[2];

  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function getCredentials() {
  const sql = "SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest' LIMIT 1";
  const result = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${sql}"`,
    { encoding: 'utf8' }
  ).trim();

  if (!result) {
    throw new Error('No Nest credentials found in database');
  }

  return JSON.parse(decrypt(result));
}

async function checkToken(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`,
      {
        method: 'GET',
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error('Token check failed:', data);
            reject(new Error(data));
            return;
          }
          resolve(JSON.parse(data));
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Checking OAuth token info...\n');

  const credentials = await getCredentials();
  console.log('Token expires at:', new Date(credentials.expires_at).toLocaleString());

  const tokenInfo = await checkToken(credentials.access_token);
  console.log('\nToken Info:', JSON.stringify(tokenInfo, null, 2));

  if (tokenInfo.scope) {
    const scopes = tokenInfo.scope.split(' ');
    console.log('\nGranted Scopes:');
    scopes.forEach(scope => console.log(`  - ${scope}`));

    if (scopes.includes('https://www.googleapis.com/auth/sdm.service')) {
      console.log('\n✓ Correct scope (sdm.service) is present');
    } else {
      console.log('\n✗ Missing required scope: https://www.googleapis.com/auth/sdm.service');
    }
  }
}

main().catch(console.error);
