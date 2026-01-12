#!/usr/bin/env node

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = 'http://localhost:3000/api/auth/nest/callback';

const scopes = [
  'https://www.googleapis.com/auth/sdm.service',
  'https://www.googleapis.com/auth/pubsub',
].join(' ');

const params = new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: scopes,
  access_type: 'offline',
  prompt: 'consent',
});

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

console.log('\n🔐 Nest OAuth Authorization\n');
console.log('1. Visit this URL:\n');
console.log(authUrl);
console.log('\n2. Authorize access to your Nest devices');
console.log('3. You will be redirected to: http://localhost:3000/api/auth/nest/callback?code=...');
console.log('4. Copy the "code" parameter from the URL');
console.log('5. Run: node scripts/nest-token-exchange.js YOUR_CODE\n');
