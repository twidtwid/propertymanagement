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

async function listDevices(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${PROJECT_ID}/devices`,
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

async function getVermontProperties() {
  const sql = "SELECT id, name FROM properties WHERE state = 'VT' ORDER BY name";
  const result = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${sql}"`,
    { encoding: 'utf8' }
  );

  return result
    .trim()
    .split('\n')
    .map(line => {
      const [id, name] = line.split('|').map(s => s.trim());
      return { id, name };
    });
}

async function insertCamera(camera, propertyId) {
  const sql = `
    INSERT INTO cameras (property_id, provider, external_id, name, location, status)
    VALUES (
      '${propertyId}',
      'nest',
      '${camera.name.split('/').pop()}',
      '${camera.traits['sdm.devices.traits.Info']?.customName || 'Nest Camera'}',
      '${camera.parentRelations?.[0]?.displayName || ''}',
      '${camera.traits['sdm.devices.traits.Connectivity']?.status === 'ONLINE' ? 'online' : 'offline'}'
    )
    ON CONFLICT (provider, external_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      location = EXCLUDED.location,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING id, name;
  `.replace(/\n/g, ' ');

  try {
    const result = execSync(
      `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${sql}"`,
      { encoding: 'utf8' }
    );
    return result.trim();
  } catch (error) {
    console.error('Failed to insert camera:', error.message);
    return null;
  }
}

async function main() {
  console.log('Discovering Nest cameras...\n');

  const accessToken = await getAccessToken();
  console.log('✓ Retrieved access token');

  const response = await listDevices(accessToken);
  console.log('\nFull API Response:', JSON.stringify(response, null, 2));

  const cameras = response.devices?.filter(d => d.type === 'sdm.devices.types.CAMERA') || [];

  console.log(`\n✓ Found ${cameras.length} camera(s)\n`);

  if (cameras.length === 0) {
    console.log('No cameras found. Make sure:');
    console.log('1. Your Nest cameras are online');
    console.log('2. They are linked to the Google account you authorized');
    console.log('3. The Device Access project has access to your home');
    return;
  }

  const properties = await getVermontProperties();
  console.log(`✓ Found ${properties.length} Vermont property/properties\n`);

  console.log('Cameras discovered:');
  console.log('─'.repeat(70));

  for (const camera of cameras) {
    const info = camera.traits['sdm.devices.traits.Info'];
    const connectivity = camera.traits['sdm.devices.traits.Connectivity'];
    const name = info?.customName || 'Nest Camera';
    const location = camera.parentRelations?.[0]?.displayName || '';
    const status = connectivity?.status || 'UNKNOWN';

    console.log(`\nCamera: ${name}`);
    console.log(`  Location: ${location || 'Not set'}`);
    console.log(`  Status: ${status}`);
    console.log(`  Device ID: ${camera.name.split('/').pop()}`);

    // Try to match to property by name
    let matchedProperty = null;
    if (name.toLowerCase().includes('main') || location.toLowerCase().includes('main')) {
      matchedProperty = properties.find(p => p.name.toLowerCase().includes('main'));
    } else if (name.toLowerCase().includes('guest') || location.toLowerCase().includes('guest')) {
      matchedProperty = properties.find(p => p.name.toLowerCase().includes('guest'));
    } else if (name.toLowerCase().includes('booth')) {
      matchedProperty = properties.find(p => p.name.toLowerCase().includes('booth'));
    }

    if (!matchedProperty && properties.length > 0) {
      matchedProperty = properties[0]; // Default to first Vermont property
    }

    if (matchedProperty) {
      console.log(`  → Assigning to: ${matchedProperty.name}`);
      const result = await insertCamera(camera, matchedProperty.id);
      if (result) {
        console.log(`  ✓ Added to database`);
      }
    } else {
      console.log(`  ⚠ No Vermont property found - skipping`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('\n✓ Camera discovery complete!');
  console.log('\nNext: Visit http://localhost:3000/cameras to view your cameras');
}

main().catch(console.error);
