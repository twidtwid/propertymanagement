const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/propertymanagement'
});

async function setup() {
  console.log('Creating email_sync_state table...');

  try {
    // Enable UUID extension if not exists
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_sync_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL UNIQUE,
        last_sync_at TIMESTAMPTZ,
        last_message_id TEXT,
        sync_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sync_state_user ON email_sync_state(user_email);
    `);

    console.log('✅ email_sync_state table created');

    // Verify vendor_communications table exists and has all needed columns
    const tableCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'vendor_communications'
      ORDER BY ordinal_position
    `);

    console.log('\nvendor_communications columns:');
    tableCheck.rows.forEach(r => console.log('  -', r.column_name));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

setup();
