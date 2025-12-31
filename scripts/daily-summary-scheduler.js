#!/usr/bin/env node
/**
 * Daily Summary Scheduler
 *
 * Sends the daily summary email at 6PM NYC time (America/New_York).
 *
 * Usage:
 *   Run continuously: node scripts/daily-summary-scheduler.js
 *
 * The script checks every minute if it's 6PM NYC time and sends the summary.
 * It tracks the last send date to avoid duplicate sends.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const SUMMARY_HOUR = 18; // 6 PM
const SUMMARY_MINUTE = 0;
const TIMEZONE = 'America/New_York';
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
const STATE_FILE = path.join(__dirname, '.daily-summary-state.json');

// Get current time in NYC timezone
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

// Load state from file
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('[Scheduler] Error loading state:', error.message);
  }
  return { lastSentDate: null };
}

// Save state to file
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[Scheduler] Error saving state:', error.message);
  }
}

// Send the daily summary via POST to the API
async function sendDailySummary() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: process.env.APP_HOST || 'localhost',
      port: process.env.APP_PORT || 3000,
      path: '/api/cron/daily-summary',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    console.log(`[Scheduler] Sending POST to http://${options.hostname}:${options.port}${options.path}`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('[Scheduler] Response:', JSON.stringify(result, null, 2));
          resolve(result);
        } catch (e) {
          console.error('[Scheduler] Invalid JSON response:', data.substring(0, 200));
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[Scheduler] Request error:', error.message);
      reject(error);
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Main scheduler loop
async function checkAndSend() {
  const nyc = getNYCTime();
  const state = loadState();

  // Check if it's time to send (6:00 PM NYC)
  const isTimeToSend = nyc.hour === SUMMARY_HOUR && nyc.minute >= SUMMARY_MINUTE && nyc.minute < SUMMARY_MINUTE + 5;
  const alreadySentToday = state.lastSentDate === nyc.date;

  if (isTimeToSend && !alreadySentToday) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Scheduler] 6 PM NYC - Sending daily summary...`);
    console.log(`[Scheduler] NYC Time: ${nyc.formatted}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const result = await sendDailySummary();

      if (result.success) {
        state.lastSentDate = nyc.date;
        state.lastSentTime = new Date().toISOString();
        state.lastResult = result;
        saveState(state);
        console.log('[Scheduler] Daily summary sent successfully!');
      } else {
        console.error('[Scheduler] Failed to send summary:', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[Scheduler] Error sending summary:', error.message);
    }
  }
}

// Start the scheduler
console.log(`\n${'='.repeat(60)}`);
console.log(`  DAILY SUMMARY SCHEDULER`);
console.log(`  Send time: ${SUMMARY_HOUR}:${String(SUMMARY_MINUTE).padStart(2, '0')} ${TIMEZONE}`);
console.log(`  Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
console.log(`${'='.repeat(60)}\n`);

const state = loadState();
console.log(`[Scheduler] Last sent: ${state.lastSentDate || 'never'}`);
console.log(`[Scheduler] Current NYC time: ${getNYCTime().formatted}`);
console.log(`[Scheduler] Waiting for 6 PM NYC...\n`);

// Check immediately, then every minute
checkAndSend();
setInterval(checkAndSend, CHECK_INTERVAL_MS);

// Log status every hour
setInterval(() => {
  const nyc = getNYCTime();
  console.log(`[Scheduler] Status check - NYC time: ${nyc.formatted}`);
}, 60 * 60 * 1000);
