#!/usr/bin/env node
/**
 * Daily Summary Script
 *
 * Generates a daily summary of property management items.
 *
 * Usage:
 *   Run manually: node scripts/daily-summary.js
 *   Output format: node scripts/daily-summary.js --format=text|html|json
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2];
});

const DATABASE_URL = envVars.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/propertymanagement';
const pool = new Pool({ connectionString: DATABASE_URL });

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntil(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function generateSummary() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const urgentItems = [];
  const upcomingItems = [];

  // Get overdue bills
  const overdueBills = await pool.query(`
    SELECT b.*, p.name as property_name
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    WHERE b.status = 'pending' AND b.due_date < CURRENT_DATE
    ORDER BY b.due_date
  `);

  for (const bill of overdueBills.rows) {
    const daysOver = -daysUntil(bill.due_date);
    urgentItems.push({
      type: 'payment_overdue',
      title: `Overdue: ${bill.description || bill.bill_type}`,
      description: `Due ${formatDate(bill.due_date)} (${daysOver} days overdue) - ${formatCurrency(Number(bill.amount))}`,
    });
  }

  // Get unconfirmed checks
  const unconfirmedChecks = await pool.query(`
    SELECT b.*, p.name as property_name
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    WHERE b.status = 'sent'
      AND b.payment_method = 'check'
      AND b.payment_date IS NOT NULL
      AND b.confirmation_date IS NULL
      AND b.payment_date + b.days_to_confirm < CURRENT_DATE
    ORDER BY b.payment_date
  `);

  for (const check of unconfirmedChecks.rows) {
    const daysSinceSent = -daysUntil(check.payment_date);
    urgentItems.push({
      type: 'check_unconfirmed',
      title: `Unconfirmed check: ${check.description || check.bill_type}`,
      description: `Sent ${formatDate(check.payment_date)} (${daysSinceSent} days) - ${formatCurrency(Number(check.amount))}`,
    });
  }

  // Get expiring insurance (within 30 days)
  const expiringPolicies = await pool.query(`
    SELECT ip.*, p.name as property_name, v.year, v.make, v.model
    FROM insurance_policies ip
    LEFT JOIN properties p ON ip.property_id = p.id
    LEFT JOIN vehicles v ON ip.vehicle_id = v.id
    WHERE ip.expiration_date <= CURRENT_DATE + 30
      AND ip.expiration_date >= CURRENT_DATE
    ORDER BY ip.expiration_date
  `);

  for (const policy of expiringPolicies.rows) {
    const days = daysUntil(policy.expiration_date);
    if (days <= 7) {
      urgentItems.push({
        type: 'insurance_expiring',
        title: `Insurance expiring soon: ${policy.carrier_name}`,
        description: `${policy.policy_type} expires ${formatDate(policy.expiration_date)} (${days} days)`,
      });
    } else {
      upcomingItems.push({
        type: 'insurance_expiring',
        title: `${policy.carrier_name} - ${policy.policy_type}`,
        description: `Expires ${formatDate(policy.expiration_date)}`,
        daysUntil: days,
      });
    }
  }

  // Get vehicle alerts
  const vehicleAlerts = await pool.query(`
    SELECT * FROM vehicles
    WHERE is_active = TRUE
      AND (
        registration_expires <= CURRENT_DATE + 30
        OR inspection_expires <= CURRENT_DATE
      )
    ORDER BY registration_expires
  `);

  for (const vehicle of vehicleAlerts.rows) {
    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

    if (vehicle.registration_expires) {
      const regDays = daysUntil(vehicle.registration_expires);
      if (regDays <= 0) {
        urgentItems.push({
          type: 'registration_expired',
          title: `Registration expired: ${vehicleName}`,
          description: `Expired ${formatDate(vehicle.registration_expires)}`,
        });
      } else if (regDays <= 30) {
        upcomingItems.push({
          type: 'registration_due',
          title: vehicleName,
          description: `Registration expires ${formatDate(vehicle.registration_expires)}`,
          daysUntil: regDays,
        });
      }
    }

    if (vehicle.inspection_expires && daysUntil(vehicle.inspection_expires) <= 0) {
      urgentItems.push({
        type: 'inspection_overdue',
        title: `Inspection overdue: ${vehicleName}`,
        description: `Expired ${formatDate(vehicle.inspection_expires)}`,
      });
    }
  }

  // Get upcoming bills (next 7 days)
  const upcomingBills = await pool.query(`
    SELECT b.*, p.name as property_name
    FROM bills b
    LEFT JOIN properties p ON b.property_id = p.id
    WHERE b.status = 'pending'
      AND b.due_date >= CURRENT_DATE
      AND b.due_date <= CURRENT_DATE + 7
    ORDER BY b.due_date
  `);

  for (const bill of upcomingBills.rows) {
    upcomingItems.push({
      type: 'bill_due',
      title: bill.description || bill.bill_type,
      description: `Due ${formatDate(bill.due_date)} - ${formatCurrency(Number(bill.amount))}`,
      daysUntil: daysUntil(bill.due_date),
    });
  }

  // Get upcoming taxes (next 30 days)
  const upcomingTaxes = await pool.query(`
    SELECT pt.*, p.name as property_name
    FROM property_taxes pt
    JOIN properties p ON pt.property_id = p.id
    WHERE pt.status = 'pending'
      AND pt.due_date >= CURRENT_DATE
      AND pt.due_date <= CURRENT_DATE + 30
    ORDER BY pt.due_date
  `);

  for (const tax of upcomingTaxes.rows) {
    upcomingItems.push({
      type: 'tax_due',
      title: `Property Tax: ${tax.jurisdiction} Q${tax.installment}`,
      description: `${tax.property_name} - Due ${formatDate(tax.due_date)} - ${formatCurrency(Number(tax.amount))}`,
      daysUntil: daysUntil(tax.due_date),
    });
  }

  // Get recent emails
  const recentEmails = await pool.query(`
    SELECT v.name as vendor_name, vc.subject, vc.received_at, vc.is_important
    FROM vendor_communications vc
    LEFT JOIN vendors v ON vc.vendor_id = v.id
    WHERE vc.received_at >= CURRENT_DATE - 1
    ORDER BY vc.received_at DESC
    LIMIT 10
  `);

  // Get stats
  const statsResult = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM bills WHERE status = 'pending' AND due_date <= CURRENT_DATE + 7) as bills_count,
      (SELECT COALESCE(SUM(amount), 0) FROM bills WHERE status = 'pending' AND due_date <= CURRENT_DATE + 7) as bills_amount,
      (SELECT COUNT(*) FROM maintenance_tasks WHERE status IN ('pending', 'in_progress') AND priority IN ('urgent', 'high')) as urgent_tasks,
      (SELECT COUNT(*) FROM vendor_communications WHERE received_at >= CURRENT_DATE) as new_emails
  `);

  const stats = statsResult.rows[0];

  // Sort upcoming by days until
  upcomingItems.sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0));

  return {
    date: todayStr,
    urgentItems,
    upcomingItems,
    recentEmails: recentEmails.rows.map(e => ({
      vendorName: e.vendor_name,
      subject: e.subject || '(No subject)',
      receivedAt: e.received_at,
      isUrgent: e.is_important,
    })),
    stats: {
      totalBillsDue: parseInt(stats.bills_count),
      totalBillsAmount: parseFloat(stats.bills_amount),
      urgentTasksCount: parseInt(stats.urgent_tasks),
      newEmailsToday: parseInt(stats.new_emails),
    },
  };
}

function formatAsText(summary) {
  const lines = [];

  lines.push('='.repeat(60));
  lines.push(`  DAILY PROPERTY MANAGEMENT SUMMARY - ${summary.date}`);
  lines.push('='.repeat(60));
  lines.push('');

  if (summary.urgentItems.length > 0) {
    lines.push('URGENT ITEMS REQUIRING ATTENTION:');
    lines.push('-'.repeat(40));
    for (const item of summary.urgentItems) {
      lines.push(`  [!] ${item.title}`);
      lines.push(`      ${item.description}`);
    }
    lines.push('');
  } else {
    lines.push('No urgent items - all clear!');
    lines.push('');
  }

  if (summary.upcomingItems.length > 0) {
    lines.push('COMING UP NEXT 7-30 DAYS:');
    lines.push('-'.repeat(40));
    for (const item of summary.upcomingItems.slice(0, 10)) {
      lines.push(`  - ${item.title}`);
      lines.push(`    ${item.description}`);
    }
    lines.push('');
  }

  if (summary.recentEmails.length > 0) {
    lines.push('RECENT VENDOR EMAILS:');
    lines.push('-'.repeat(40));
    for (const email of summary.recentEmails.slice(0, 5)) {
      const urgentMark = email.isUrgent ? ' [URGENT]' : '';
      lines.push(`  - ${email.vendorName || 'Unknown'}: ${email.subject}${urgentMark}`);
    }
    lines.push('');
  }

  lines.push('SUMMARY STATS:');
  lines.push('-'.repeat(40));
  lines.push(`  Bills due this week: ${summary.stats.totalBillsDue} (${formatCurrency(summary.stats.totalBillsAmount)})`);
  lines.push(`  Urgent tasks: ${summary.stats.urgentTasksCount}`);
  lines.push(`  New emails today: ${summary.stats.newEmailsToday}`);
  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

// Run
async function main() {
  const args = process.argv.slice(2);
  const formatArg = args.find(a => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : 'text';

  console.log('\nGenerating daily summary...\n');

  try {
    const summary = await generateSummary();

    if (format === 'json') {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(formatAsText(summary));
    }

    pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error generating summary:', error);
    pool.end();
    process.exit(1);
  }
}

main();
