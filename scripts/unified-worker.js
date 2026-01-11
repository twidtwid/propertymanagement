#!/usr/bin/env node
/**
 * Unified Worker
 *
 * Consolidates email-sync, daily-summary, and smart-pins-sync into one service.
 * Reduces container count from 3 to 1 while maintaining all functionality.
 *
 * Tasks:
 * 1. Email Sync: Every 10 minutes (syncs Gmail messages)
 * 2. Smart Pins Sync: Every 60 minutes (auto-pins urgent items)
 * 3. Daily Summary: Once per day at 6 PM NYC (sends email summary)
 *
 * Usage:
 *   node scripts/unified-worker.js
 *
 * Environment variables:
 *   APP_HOST - App hostname (default: localhost)
 *   APP_PORT - App port (default: 3000)
 *   CRON_SECRET - Authentication secret for cron endpoints
 *   EMAIL_SYNC_INTERVAL - Minutes between email syncs (default: 10)
 *   SMART_PINS_INTERVAL - Minutes between smart pins syncs (default: 60)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

// ============================================================================
// Configuration
// ============================================================================

const APP_HOST = process.env.APP_HOST || 'localhost';
const APP_PORT = process.env.APP_PORT || 3000;
const EMAIL_SYNC_INTERVAL = parseInt(process.env.EMAIL_SYNC_INTERVAL || '10', 10);
const SMART_PINS_INTERVAL = parseInt(process.env.SMART_PINS_INTERVAL || '60', 10);
const DAILY_SUMMARY_HOUR = 18; // 6 PM
const DAILY_SUMMARY_MINUTE = 0;
const TIMEZONE = 'America/New_York';

const STATE_FILE = path.join(__dirname, '.unified-worker-state.json');

// Read .env.local (for local development)
const envVars = {};
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) envVars[match[1]] = match[2];
    });
  }
} catch (err) {
  // .env.local not found - using process.env only (expected in Docker)
}

const CRON_SECRET = process.env.CRON_SECRET || envVars.CRON_SECRET;
const DATABASE_URL = process.env.DATABASE_URL || envVars.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/propertymanagement';

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not found in environment');
  process.exit(1);
}

// Database pool for email sync
const pool = new Pool({ connectionString: DATABASE_URL });

// ============================================================================
// State Management
// ============================================================================

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('[State] Error loading state:', error.message);
  }
  return {
    lastEmailSync: null,
    lastSmartPinsSync: null,
    lastDailySummary: null,
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[State] Error saving state:', error.message);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function getNYCTime() {
  const now = new Date();
  const nycTime = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return {
    date: nycTime.toISOString().split('T')[0],
    hour: nycTime.getHours(),
    minute: nycTime.getMinutes(),
    formatted: nycTime.toLocaleString('en-US', { timeZone: TIMEZONE })
  };
}

function makeRequest(endpoint, description, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: APP_HOST,
      port: APP_PORT,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    };

    console.log(`[${description}] ${method} http://${APP_HOST}:${APP_PORT}${endpoint}`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log(`[${description}] ✓ Success`);
            resolve(result);
          } else {
            console.error(`[${description}] ✗ HTTP ${res.statusCode}:`, result.error || result);
            reject(new Error(result.error || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          console.error(`[${description}] ✗ Invalid JSON response:`, data.substring(0, 200));
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[${description}] ✗ Request error:`, error.message);
      reject(error);
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// ============================================================================
// Task 1: Email Sync
// ============================================================================

async function runEmailSync() {
  console.log('\n' + '='.repeat(60));
  console.log('  EMAIL SYNC');
  console.log('='.repeat(60));

  try {
    await makeRequest('/api/cron/sync-emails', 'Email Sync');

    const state = loadState();
    state.lastEmailSync = new Date().toISOString();
    saveState(state);

    // Update health check state
    await updateHealthCheckState('email_sync', 'ok');
  } catch (error) {
    console.error('[Email Sync] Failed:', error.message);
    await updateHealthCheckState('email_sync', 'critical');
  }
}

// ============================================================================
// Task 2: Smart Pins Sync
// ============================================================================

async function runSmartPinsSync() {
  console.log('\n' + '='.repeat(60));
  console.log('  SMART PINS SYNC');
  console.log('='.repeat(60));

  try {
    await makeRequest('/api/cron/sync-smart-pins', 'Smart Pins');

    const state = loadState();
    state.lastSmartPinsSync = new Date().toISOString();
    saveState(state);
  } catch (error) {
    console.error('[Smart Pins] Failed:', error.message);
  }
}

// ============================================================================
// Task 3: Daily Summary
// ============================================================================

async function runDailySummary() {
  console.log('\n' + '='.repeat(60));
  console.log('  DAILY SUMMARY - 6 PM NYC');
  console.log('='.repeat(60));

  try {
    await makeRequest('/api/cron/daily-summary', 'Daily Summary');

    const state = loadState();
    state.lastDailySummary = getNYCTime().date;
    saveState(state);

    // Update health check state
    await updateHealthCheckState('daily_summary', 'ok');
  } catch (error) {
    console.error('[Daily Summary] Failed:', error.message);
    await updateHealthCheckState('daily_summary', 'warning');
  }
}

// ============================================================================
// Health Check State Updates
// ============================================================================

async function updateHealthCheckState(checkName, status) {
  try {
    await pool.query(`
      INSERT INTO health_check_state (check_name, status, last_checked_at, failure_count)
      VALUES ($1, $2, NOW(), CASE WHEN $2 = 'ok' THEN 0 ELSE 1 END)
      ON CONFLICT (check_name)
      DO UPDATE SET
        status = $2,
        last_checked_at = NOW(),
        failure_count = CASE
          WHEN $2 = 'ok' THEN 0
          WHEN health_check_state.status != $2 THEN health_check_state.failure_count + 1
          ELSE health_check_state.failure_count
        END,
        first_failure_at = CASE
          WHEN $2 = 'ok' THEN NULL
          WHEN health_check_state.status = 'ok' THEN NOW()
          ELSE health_check_state.first_failure_at
        END
    `, [checkName, status]);
  } catch (error) {
    console.error(`[Health] Failed to update ${checkName}:`, error.message);
  }
}

// ============================================================================
// Main Scheduler
// ============================================================================

async function mainLoop() {
  const state = loadState();
  const nyc = getNYCTime();
  const now = new Date();

  // Task 1: Email Sync (every 10 minutes)
  const lastEmailSync = state.lastEmailSync ? new Date(state.lastEmailSync) : null;
  const minutesSinceEmailSync = lastEmailSync ? (now - lastEmailSync) / 1000 / 60 : Infinity;

  if (minutesSinceEmailSync >= EMAIL_SYNC_INTERVAL) {
    await runEmailSync();
  }

  // Task 2: Smart Pins Sync (every 60 minutes)
  const lastSmartPinsSync = state.lastSmartPinsSync ? new Date(state.lastSmartPinsSync) : null;
  const minutesSinceSmartPins = lastSmartPinsSync ? (now - lastSmartPinsSync) / 1000 / 60 : Infinity;

  if (minutesSinceSmartPins >= SMART_PINS_INTERVAL) {
    await runSmartPinsSync();
  }

  // Task 3: Daily Summary (once at 6 PM NYC)
  const isTimeToSend = nyc.hour === DAILY_SUMMARY_HOUR && nyc.minute >= DAILY_SUMMARY_MINUTE && nyc.minute < DAILY_SUMMARY_MINUTE + 5;
  const alreadySentToday = state.lastDailySummary === nyc.date;

  if (isTimeToSend && !alreadySentToday) {
    await runDailySummary();
  }
}

// ============================================================================
// Startup
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('  UNIFIED WORKER');
console.log('='.repeat(60));
console.log(`  Email Sync: Every ${EMAIL_SYNC_INTERVAL} minutes`);
console.log(`  Smart Pins: Every ${SMART_PINS_INTERVAL} minutes`);
console.log(`  Daily Summary: ${DAILY_SUMMARY_HOUR}:${String(DAILY_SUMMARY_MINUTE).padStart(2, '0')} ${TIMEZONE}`);
console.log(`  Target: http://${APP_HOST}:${APP_PORT}`);
console.log('='.repeat(60));

const state = loadState();
console.log(`\n[State] Last email sync: ${state.lastEmailSync || 'never'}`);
console.log(`[State] Last smart pins sync: ${state.lastSmartPinsSync || 'never'}`);
console.log(`[State] Last daily summary: ${state.lastDailySummary || 'never'}`);
console.log(`[State] Current NYC time: ${getNYCTime().formatted}\n`);

// Run immediately on startup, then every minute
mainLoop().catch(err => console.error('[Startup] Initial run failed:', err));
setInterval(() => {
  mainLoop().catch(err => console.error('[Loop] Error:', err));
}, 60 * 1000);

// Status log every hour
setInterval(() => {
  const nyc = getNYCTime();
  console.log(`\n[Status] ${nyc.formatted} - Worker running`);
}, 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[Shutdown] Received SIGTERM, closing...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[Shutdown] Received SIGINT, closing...');
  await pool.end();
  process.exit(0);
});
