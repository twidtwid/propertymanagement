#!/usr/bin/env node
/**
 * Re-match all vendor communications to vendors using the correct matching logic.
 * Only matches by exact email or domain (excluding common providers).
 * No name matching to prevent false positives.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local
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
} catch (err) {}

const DATABASE_URL = process.env.DATABASE_URL || envVars.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/propertymanagement';
const pool = new Pool({ connectionString: DATABASE_URL });

console.log('Using database:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

// Common/public email providers - these should not match vendors by domain
const commonDomains = new Set([
  // Major providers
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.ca',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aol.co.uk',
  // ISP providers
  'comcast.net', 'xfinity.com', 'verizon.net', 'att.net', 'sbcglobal.net',
  'cox.net', 'charter.net', 'spectrum.net', 'frontier.com', 'centurylink.net',
  'earthlink.net', 'windstream.net', 'optimum.net', 'optonline.net',
  // Other common providers
  'protonmail.com', 'proton.me', 'tutanota.com', 'zoho.com',
  'ymail.com', 'rocketmail.com', 'mail.com', 'email.com',
  'usa.com', 'post.com', 'inbox.com', 'gmx.com', 'gmx.net',
  // International
  'mail.ru', 'yandex.com', 'qq.com', '163.com', '126.com',
  'web.de', 'freenet.de', 't-online.de', 'orange.fr', 'wanadoo.fr',
  'libero.it', 'virgilio.it', 'btinternet.com', 'sky.com', 'talktalk.net',
  // Educational (often personal accounts)
  'edu', 'ac.uk',
]);

function extractDomain(email) {
  const match = email.toLowerCase().match(/@([^@]+)$/);
  return match ? match[1] : null;
}

function extractRootDomain(domain) {
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

function parseVendorEmails(emailField) {
  if (!emailField) return [];
  return emailField
    .split(/[,;]/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0 && e.includes('@'));
}

async function rematchEmails() {
  console.log('\n=== Re-matching all vendor emails ===\n');

  // Get all active vendors
  const vendorResult = await pool.query(`
    SELECT id, name, email, company
    FROM vendors
    WHERE is_active = TRUE AND email IS NOT NULL AND email != ''
  `);
  const vendors = vendorResult.rows;
  console.log(`Found ${vendors.length} active vendors with email addresses`);

  // Build lookup maps for matching
  const exactEmailMap = new Map();
  const domainMap = new Map();

  for (const vendor of vendors) {
    const vendorEmails = parseVendorEmails(vendor.email);
    for (const email of vendorEmails) {
      exactEmailMap.set(email, vendor);

      const domain = extractDomain(email);
      const rootDomain = extractRootDomain(domain);
      if (domain && !commonDomains.has(domain) && !commonDomains.has(rootDomain)) {
        if (!domainMap.has(domain)) domainMap.set(domain, vendor);
        if (rootDomain && !domainMap.has(rootDomain)) domainMap.set(rootDomain, vendor);
      }
    }
  }

  console.log(`Built lookup maps: ${exactEmailMap.size} exact emails, ${domainMap.size} domains`);

  // Get all emails
  const emailResult = await pool.query(`
    SELECT id, from_email, vendor_id
    FROM vendor_communications
    ORDER BY received_at DESC
  `);
  const emails = emailResult.rows;
  console.log(`Found ${emails.length} emails to process\n`);

  let matched = 0;
  let unmatched = 0;
  let changed = 0;
  let exactMatches = 0;
  let domainMatches = 0;

  for (const email of emails) {
    const fromEmail = email.from_email?.toLowerCase() || '';
    const domain = extractDomain(fromEmail);
    const rootDomain = extractRootDomain(domain);

    let newVendorId = null;
    let matchType = null;

    // Try exact email match first
    const exactMatch = exactEmailMap.get(fromEmail);
    if (exactMatch) {
      newVendorId = exactMatch.id;
      matchType = 'exact';
      exactMatches++;
    }
    // Try domain match (excluding common providers)
    else if (domain && !commonDomains.has(domain) && !commonDomains.has(rootDomain)) {
      const domainMatch = domainMap.get(domain) || domainMap.get(rootDomain);
      if (domainMatch) {
        newVendorId = domainMatch.id;
        matchType = 'domain';
        domainMatches++;
      }
    }

    if (newVendorId) {
      matched++;
    } else {
      unmatched++;
    }

    // Update if changed
    if (email.vendor_id !== newVendorId) {
      await pool.query(
        'UPDATE vendor_communications SET vendor_id = $1 WHERE id = $2',
        [newVendorId, email.id]
      );
      changed++;
    }
  }

  console.log('=== Results ===');
  console.log(`Total emails: ${emails.length}`);
  console.log(`Matched: ${matched} (${exactMatches} exact, ${domainMatches} domain)`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`Changed: ${changed}`);

  await pool.end();
}

rematchEmails().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
