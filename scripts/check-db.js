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

const pool = new Pool({ connectionString: envVars.DATABASE_URL });

async function main() {
  try {
    // Check tables
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Existing tables:', tables.rows.map(r => r.table_name).join(', '));

    // Check if gmail_oauth_tokens exists
    const gmailTable = tables.rows.find(r => r.table_name === 'gmail_oauth_tokens');
    console.log('\ngmail_oauth_tokens table:', gmailTable ? 'EXISTS' : 'NEEDS TO BE CREATED');

    // Check vendors
    const vendors = await pool.query('SELECT id, name, email, specialty FROM vendors ORDER BY name');
    console.log('\nCurrent vendors (' + vendors.rows.length + '):');
    vendors.rows.forEach(v => {
      console.log(`  - ${v.name} (${v.specialty}) ${v.email ? '📧 ' + v.email : '❌ no email'}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
