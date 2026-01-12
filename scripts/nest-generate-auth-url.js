#!/usr/bin/env node

const CLIENT_ID = '120115699308-jt3jqkgvp4du0cjsmf6fn3p3vtu4ruos.apps.googleusercontent.com';
const REDIRECT_URI = 'http://localhost:3000/api/auth/nest/callback';

const params = new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  access_type: 'offline',
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/sdm.service',
  prompt: 'consent', // Force consent screen to show
});

const authUrl = `https://nestservices.google.com/partnerconnections/${process.env.PROJECT_ID || '734ce5e7-4da8-45d4-a840-16d2905e165e'}/auth?${params}`;

console.log('\n' + '='.repeat(80));
console.log('NEST DEVICE ACCESS - AUTHORIZATION URL');
console.log('='.repeat(80));
console.log('\n⚠️  IMPORTANT: Use this URL instead of the standard Google OAuth URL');
console.log('\nThis URL uses the Nest-specific authorization endpoint which properly');
console.log('links your Device Access project to your home structures.\n');
console.log('Visit this URL in your browser:\n');
console.log(authUrl);
console.log('\n' + '='.repeat(80));
console.log('\nSteps:');
console.log('1. Visit the URL above in your browser');
console.log('2. Sign in with homeastronaut8@gmail.com');
console.log('3. You should see a screen to SELECT YOUR HOME/STRUCTURE');
console.log('4. Grant access to your home');
console.log('5. Copy the full callback URL from your browser');
console.log('6. Run: node scripts/nest-token-exchange.js "YOUR_CODE"');
console.log('='.repeat(80) + '\n');
