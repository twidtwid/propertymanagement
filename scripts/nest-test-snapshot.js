#!/usr/bin/env node
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { Dropbox } = require('dropbox');

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

async function getCredentials(provider) {
  const sql = `SELECT credentials_encrypted FROM camera_credentials WHERE provider = '${provider}' LIMIT 1`;
  const result = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${sql}"`,
    { encoding: 'utf8' }
  ).trim();

  if (!result) {
    throw new Error(`No ${provider} credentials found`);
  }

  return JSON.parse(decrypt(result));
}

async function getDropboxToken() {
  const sql = "SELECT access_token_encrypted, namespace_id FROM dropbox_oauth_tokens LIMIT 1";
  const result = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${sql}"`,
    { encoding: 'utf8' }
  ).trim();

  if (!result) {
    throw new Error('No Dropbox credentials found');
  }

  const [accessTokenEnc, namespaceId] = result.split('|').map(s => s.trim());
  return {
    accessToken: decrypt(accessTokenEnc),
    namespaceId: namespaceId || undefined
  };
}

async function fetchSnapshot(deviceId, accessToken) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      command: 'sdm.devices.commands.CameraImage.GenerateImage',
      params: {}
    });

    const req = https.request(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${PROJECT_ID}/devices/${deviceId}:executeCommand`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': payload.length
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', async () => {
          if (res.statusCode !== 200) {
            console.error('API Error:', data);
            reject(new Error(data));
            return;
          }

          const result = JSON.parse(data);
          console.log('✓ Generated snapshot URL from Nest API');

          // Fetch the actual image
          https.get(result.results.url, (imgRes) => {
            const chunks = [];
            imgRes.on('data', (chunk) => chunks.push(chunk));
            imgRes.on('end', () => {
              resolve(Buffer.concat(chunks));
            });
          }).on('error', reject);
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Testing Nest snapshot fetch...\n');

  // Get camera
  const cameraSql = "SELECT id, external_id, name, property_id FROM cameras LIMIT 1";
  const cameraResult = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${cameraSql}"`,
    { encoding: 'utf8' }
  ).trim();

  const [cameraId, externalId, cameraName, propertyId] = cameraResult.split('|').map(s => s.trim());
  console.log(`Camera: ${cameraName}`);
  console.log(`External ID: ${externalId}\n`);

  // Get property name
  const propertySql = `SELECT name FROM properties WHERE id = '${propertyId}'`;
  const propertyName = execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -t -c "${propertySql}"`,
    { encoding: 'utf8' }
  ).trim();

  // Fetch snapshot
  const nestCreds = await getCredentials('nest');
  console.log('Fetching snapshot from Nest API...');
  const imageBuffer = await fetchSnapshot(externalId, nestCreds.access_token);
  console.log(`✓ Downloaded image (${imageBuffer.length} bytes)\n`);

  // Upload to Dropbox
  const dropboxCreds = await getDropboxToken();
  const dbx = new Dropbox({
    accessToken: dropboxCreds.accessToken,
    selectUser: dropboxCreds.namespaceId
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const dropboxPath = `/Cameras/${propertyName}/${cameraName}/${timestamp}.jpg`;

  console.log(`Uploading to Dropbox: ${dropboxPath}`);
  const uploadResponse = await dbx.filesUpload({
    path: dropboxPath,
    contents: imageBuffer,
    mode: 'add',
    autorename: true
  });
  console.log('✓ Uploaded to Dropbox\n');

  // Create public link
  console.log('Creating public share link...');
  const shareLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
    path: uploadResponse.result.path_display,
    settings: {
      requested_visibility: 'public',
      audience: 'public',
      access: 'viewer'
    }
  });

  const sharedLink = shareLinkResponse.result.url.replace('?dl=0', '?raw=1');
  console.log(`✓ Public link: ${sharedLink}\n`);

  // Update database
  const updateSql = `UPDATE cameras SET snapshot_url = '${sharedLink}', snapshot_captured_at = NOW(), status = 'online', last_online = NOW() WHERE id = '${cameraId}'`;
  execSync(
    `docker exec -i propertymanagement-db-1 psql -U postgres -d propertymanagement -c "${updateSql}"`,
    { encoding: 'utf8' }
  );
  console.log('✓ Updated database\n');

  console.log('Success! Refresh http://localhost:3000/cameras to see the snapshot.');
}

main().catch(console.error);
