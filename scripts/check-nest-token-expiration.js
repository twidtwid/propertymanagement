#!/usr/bin/env node
/**
 * Check Nest Legacy Token Expiration
 *
 * Checks if token expires within 7 days and sends Pushover alert if needed.
 * This is the production-ready approach used by Home Assistant.
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

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
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN || envVars.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER || envVars.PUSHOVER_USER;

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

function sendPushoverAlert(title, message, priority = 0) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      token: PUSHOVER_TOKEN,
      user: PUSHOVER_USER,
      title: title,
      message: message,
      priority: priority,
    });

    const options = {
      hostname: 'api.pushover.net',
      port: 443,
      path: '/1/messages.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`Pushover failed: ${res.statusCode} ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function checkTokenExpiration() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Get current credentials
    const result = await pool.query(
      "SELECT credentials_encrypted FROM camera_credentials WHERE provider = 'nest_legacy'"
    );

    if (result.rows.length === 0) {
      console.log('✗ No nest_legacy credentials found');
      return { needsAction: false };
    }

    const creds = JSON.parse(decryptToken(result.rows[0].credentials_encrypted));
    const expiresAt = new Date(creds.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

    console.log(`Token expires: ${expiresAt.toISOString()}`);
    console.log(`Days until expiry: ${daysUntilExpiry}`);

    // Token expired
    if (expiresAt < now) {
      console.log('⚠️  TOKEN EXPIRED - cameras are broken!');

      if (PUSHOVER_TOKEN && PUSHOVER_USER) {
        await sendPushoverAlert(
          '🚨 NEST LEGACY TOKEN EXPIRED - CAMERAS BROKEN',
          `CRITICAL: Nest Legacy cameras are NOT WORKING!\n\nThe token has EXPIRED.\n\nFIX THIS NOW:\n1. Open home.nest.com in browser\n2. Press F12 → Application → Cookies\n3. Copy "user_token" cookie value\n4. SSH to prod: ssh root@143.110.229.185\n5. Run: cd /root/app && npm run nest:update-token <token>\n\nCameras will work again immediately after update.`,
          1 // High priority
        );
        console.log('✓ Sent Pushover alert (high priority)');
      }

      return { needsAction: true, daysUntilExpiry, status: 'expired' };
    }

    // Token expires within 7 days - escalating funny messages
    if (daysUntilExpiry <= 7) {
      console.log(`⚠️  Token expires in ${daysUntilExpiry} days - action needed soon`);

      if (PUSHOVER_TOKEN && PUSHOVER_USER) {
        const funnyMessages = {
          7: {
            title: '🎯 Nest Legacy Token Expires in 7 Days',
            message: `ACTION NEEDED: Your Nest Legacy camera token expires in ${daysUntilExpiry} days.\n\nCameras will stop working when the token expires.\n\nTO UPDATE THE TOKEN:\n1. Open home.nest.com in browser\n2. Press F12 → Application → Cookies\n3. Copy the "user_token" cookie value\n4. SSH to server: ssh root@143.110.229.185\n5. Run: cd /root/app && npm run nest:update-token <paste-token-here>\n\nThis takes 2 minutes. Don't wait until it breaks! 📷`
          },
          6: {
            title: '⏰ Nest Legacy Token Expires in 6 Days',
            message: `REMINDER: Nest Legacy cameras expire in ${daysUntilExpiry} days.\n\nTO FIX:\n1. Go to home.nest.com\n2. Open DevTools (F12) → Application → Cookies\n3. Copy "user_token" cookie value\n4. SSH: ssh root@143.110.229.185\n5. Run: cd /root/app && npm run nest:update-token <token>\n\nDon't let the cameras go dark! 👻`
          },
          5: {
            title: '🚨 Nest Legacy Token Expires in 5 Days',
            message: `URGENT: Only ${daysUntilExpiry} days until Nest Legacy cameras stop working!\n\nUPDATE THE TOKEN NOW:\n1. home.nest.com\n2. F12 → Application → Cookies → "user_token"\n3. Copy the value\n4. ssh root@143.110.229.185\n5. cd /root/app\n6. npm run nest:update-token <paste-value>\n\nDo it before you forget! 📅`
          },
          4: {
            title: '😬 Nest Legacy Token Expires in 4 Days',
            message: `WARNING: Nest Legacy cameras expire in ${daysUntilExpiry} days.\n\nSTEPS TO UPDATE TOKEN:\n1. Open home.nest.com\n2. DevTools (F12) → Application → Cookies\n3. Copy "user_token" cookie\n4. SSH to prod: ssh root@143.110.229.185\n5. Run: cd /root/app && npm run nest:update-token <token>\n\nDon't wait until it's broken! 💼`
          },
          3: {
            title: '😰 Nest Legacy Token Expires in 3 Days',
            message: `ALERT: Only ${daysUntilExpiry} days left!\n\nNest Legacy cameras will stop working when token expires.\n\nUPDATE NOW:\n1. home.nest.com\n2. F12 → Application → Cookies\n3. Copy "user_token" value\n4. ssh root@143.110.229.185\n5. cd /root/app && npm run nest:update-token <token>\n\nSeriously, do this today! 🍪`
          },
          2: {
            title: '🆘 URGENT: Nest Token Expires in 2 DAYS',
            message: `CRITICAL: Only ${daysUntilExpiry} days until cameras stop working!\n\nUPDATE THE TOKEN RIGHT NOW:\n1. home.nest.com\n2. F12 → Application → Cookies\n3. Copy "user_token"\n4. ssh root@143.110.229.185\n5. cd /root/app\n6. npm run nest:update-token <paste-token>\n\nDo this TODAY or cameras break tomorrow! 🧻📷`
          },
          1: {
            title: '🔥 EMERGENCY: Nest Token Expires TOMORROW',
            message: `LAST CHANCE! Nest Legacy cameras expire in 1 DAY!\n\nUPDATE TOKEN IMMEDIATELY:\n1. Open home.nest.com RIGHT NOW\n2. Press F12 → Application → Cookies\n3. Copy "user_token" cookie value\n4. ssh root@143.110.229.185\n5. cd /root/app\n6. npm run nest:update-token <token-value>\n\nIf you don't do this today, cameras stop working tomorrow! 🚨`
          },
          0: {
            title: '💀 CRITICAL: Nest Token Expires TODAY',
            message: `EMERGENCY! Nest Legacy cameras expire in HOURS!\n\n⚡ DO THIS RIGHT NOW ⚡\n1. Open home.nest.com IMMEDIATELY\n2. F12 → Application → Cookies\n3. Copy "user_token" value\n4. ssh root@143.110.229.185\n5. cd /root/app\n6. npm run nest:update-token <token>\n\nCameras will break in hours if you don't do this NOW! 💀`
          }
        };

        const message = funnyMessages[daysUntilExpiry] || funnyMessages[7];

        await sendPushoverAlert(
          message.title,
          message.message,
          daysUntilExpiry <= 2 ? 1 : 0 // High priority for 2 days or less
        );
        console.log('✓ Sent Pushover alert (with humor)');
      }

      return { needsAction: true, daysUntilExpiry, status: 'expiring_soon' };
    }

    // Token is fine
    console.log(`✓ Token is valid for ${daysUntilExpiry} more days`);
    return { needsAction: false, daysUntilExpiry, status: 'ok' };

  } finally {
    await pool.end();
  }
}

// Run check
checkTokenExpiration()
  .then(result => {
    if (result.needsAction) {
      process.exit(1); // Exit with error code to trigger health check alert
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
