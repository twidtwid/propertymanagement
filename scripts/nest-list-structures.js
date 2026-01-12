#!/usr/bin/env node
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PROJECT_ID = '734ce5e7-4da8-45d4-a840-16d2905e165e';
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

async function getAccessToken() {
  const sql = "SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest' LIMIT 1";
  const result = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${sql}"`,
    { encoding: 'utf8' }
  ).trim();

  if (!result) {
    throw new Error('No Nest credentials found in database');
  }

  const credentials = JSON.parse(decrypt(result));
  return credentials.access_token;
}

async function listStructures(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${PROJECT_ID}/structures`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error('API Error:', data);
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
  console.log('Checking Nest structures...\n');

  const accessToken = await getAccessToken();
  console.log('✓ Retrieved access token');

  const response = await listStructures(accessToken);
  console.log('\nStructures API Response:', JSON.stringify(response, null, 2));

  if (response.structures && response.structures.length > 0) {
    console.log(`\n✓ Found ${response.structures.length} structure(s)`);
    response.structures.forEach(structure => {
      console.log(`\nStructure: ${structure.name}`);
      console.log(`  ID: ${structure.name.split('/').pop()}`);
      if (structure.traits) {
        console.log('  Traits:', Object.keys(structure.traits).join(', '));
      }
    });
  } else {
    console.log('\n⚠ No structures found');
    console.log('\nThis means your Device Access project cannot see your home.');
    console.log('Possible causes:');
    console.log('1. OAuth was done with wrong Google account');
    console.log('2. Device Access project needs to be linked to home');
    console.log('3. Propagation delay (wait 5-10 minutes after OAuth)');
  }
}

main().catch(console.error);
