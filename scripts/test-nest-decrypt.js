#!/usr/bin/env node
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');

async function test() {
  const result = await pool.query("SELECT credentials_encrypted FROM camera_credentials WHERE provider = $1", ["nest_legacy"]);
  const encrypted = result.rows[0].credentials_encrypted;
  console.log("Encrypted length:", encrypted?.length);

  try {
    const buffer = Buffer.from(encrypted, "base64");
    console.log("Buffer length:", buffer.length);
    console.log("IV (first 16 bytes):", buffer.subarray(0, 16).toString('hex'));

    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(buffer.length - 16);
    const ciphertext = buffer.subarray(16, buffer.length - 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = decipher.update(ciphertext, null, "utf8") + decipher.final("utf8");
    console.log("Decrypted OK! Length:", decrypted.length);
    const data = JSON.parse(decrypted);
    console.log("Has issue_token:", !!data.issue_token);
    console.log("Has cookies:", !!data.cookies);
  } catch (err) {
    console.error("Decryption error:", err.message);
  }

  await pool.end();
}

test();
