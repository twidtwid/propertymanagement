#!/usr/bin/env node
/**
 * Smart Pins Sync Script
 *
 * Auto-pins items based on business rules:
 * - Bills: Overdue, awaiting confirmation >14d, or due within 7d
 * - Tickets: Urgent/high priority and pending/in-progress
 * - BuildingLink: Critical/important messages from last 7 days
 *
 * Usage:
 *   Run manually: node scripts/sync-smart-pins.js
 *   Run continuously: node scripts/sync-smart-pins.js --watch
 *   Run with interval: node scripts/sync-smart-pins.js --watch --interval=60
 *
 * Cron example (every hour):
 *   crontab: 0 * * * * cd /path/to/project && node scripts/sync-smart-pins.js
 */

const fs = require('fs');
const path = require('path');

// Read .env.local (for local development) - optional in production
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

const APP_HOST = process.env.APP_HOST || 'localhost';
const APP_PORT = process.env.APP_PORT || '3000';
const CRON_SECRET = process.env.CRON_SECRET || envVars.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not found in environment');
  process.exit(1);
}

// Main sync function
async function syncSmartPins() {
  const timestamp = new Date().toISOString();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SMART PINS SYNC - ${timestamp}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const url = `http://${APP_HOST}:${APP_PORT}/api/cron/sync-smart-pins`;
    console.log(`📌 Syncing smart pins: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  SYNC COMPLETE`);
    console.log(`  Duration: ${result.duration_ms}ms`);
    console.log(`  Message: ${result.message}`);
    console.log(`${'─'.repeat(60)}\n`);

    return { success: true, result };

  } catch (error) {
    const errMsg = error.message || error.toString() || 'Unknown error';
    console.error('\n❌ Sync error:', errMsg);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    return { success: false, error: errMsg };
  }
}

// Run mode
const args = process.argv.slice(2);
const watchMode = args.includes('--watch') || args.includes('-w');
const intervalMinutes = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '60');

if (watchMode) {
  console.log(`\n🔄 Starting smart pins sync in watch mode (every ${intervalMinutes} minutes)`);
  console.log('   Press Ctrl+C to stop\n');

  // Run immediately
  syncSmartPins();

  // Then run on interval
  setInterval(syncSmartPins, intervalMinutes * 60 * 1000);
} else {
  // Single run
  syncSmartPins().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
