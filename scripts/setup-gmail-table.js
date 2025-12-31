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
    // Create gmail_oauth_tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gmail_oauth_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT NOT NULL UNIQUE,
        access_token_encrypted TEXT NOT NULL,
        refresh_token_encrypted TEXT NOT NULL,
        token_expiry TIMESTAMPTZ NOT NULL,
        scopes TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ gmail_oauth_tokens table created');

    // Create vendor_communications table for Phase 2
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_communications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
        gmail_message_id TEXT UNIQUE NOT NULL,
        thread_id TEXT,
        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        from_email TEXT NOT NULL,
        to_email TEXT NOT NULL,
        subject TEXT,
        body_snippet TEXT,
        body_html TEXT,
        received_at TIMESTAMPTZ NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        is_important BOOLEAN DEFAULT FALSE,
        has_attachment BOOLEAN DEFAULT FALSE,
        attachment_names TEXT[],
        labels TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ vendor_communications table created');

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_comms_vendor ON vendor_communications(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_vendor_comms_date ON vendor_communications(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vendor_comms_gmail_id ON vendor_communications(gmail_message_id);
    `);
    console.log('✅ Indexes created');

    console.log('\n📋 Next steps:');
    console.log('1. Set up Google Cloud project with Gmail API enabled');
    console.log('2. Create OAuth 2.0 credentials (Web application)');
    console.log('3. Add to .env.local:');
    console.log('   GOOGLE_CLIENT_ID=your_client_id');
    console.log('   GOOGLE_CLIENT_SECRET=your_client_secret');
    console.log('   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback');
    console.log('   TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)');
    console.log('   NOTIFICATION_EMAIL=anne@annespalter.com');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
