#!/usr/bin/env node
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ENCRYPTION_KEY = '67eaf68c739d0a0b88efb1efad3a176a193f2c97aa2784c045eb55f9bdc07782';
const PROJECT_ID = '734ce5e7-4da8-45d4-a840-16d2905e165e';

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

  const creds = JSON.parse(decrypt(result));
  return creds.access_token;
}

async function checkDevice(deviceId, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${PROJECT_ID}/devices/${deviceId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
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
  console.log('Checking Nest camera capabilities...\n');

  const cameraSql = "SELECT external_id, name FROM cameras LIMIT 1";
  const cameraResult = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${cameraSql}"`,
    { encoding: 'utf8' }
  ).trim();

  const [externalId, cameraName] = cameraResult.split('|').map(s => s.trim());
  console.log(`Camera: ${cameraName}\n`);

  const accessToken = await getAccessToken();
  const device = await checkDevice(externalId, accessToken);

  console.log('Device Type:', device.type);
  console.log('\nAvailable Traits:');
  for (const trait of Object.keys(device.traits)) {
    console.log(`  - ${trait}`);
    if (trait.includes('Camera')) {
      console.log('    ', JSON.stringify(device.traits[trait], null, 2).split('\n').join('\n     '));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS:');
  console.log('='.repeat(70));

  if (device.traits['sdm.devices.traits.CameraImage']) {
    console.log('✓ CameraImage trait present');
    console.log('  However, battery cameras may not support GenerateImage command');
  }

  if (device.traits['sdm.devices.traits.CameraEventImage']) {
    console.log('✓ CameraEventImage trait present');
    console.log('  Can get images from motion/person events via Pub/Sub');
  }

  if (device.traits['sdm.devices.traits.CameraLiveStream']) {
    console.log('✓ CameraLiveStream trait present');
    console.log('  Can generate WebRTC stream and capture frames');
    console.log('  Protocols:', device.traits['sdm.devices.traits.CameraLiveStream'].supportedProtocols);
  }
}

main().catch(console.error);
