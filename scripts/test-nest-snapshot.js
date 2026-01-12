#!/usr/bin/env node

// Simple test to verify Nest API token works
const https = require('https');

const token = process.argv[2];
const cameraUuid = process.argv[3] || '8f935ee7f548450a844a5a91b7ce4a9f'; // Entryway

if (!token) {
  console.error('Usage: node test-nest-snapshot.js <token> [camera-uuid]');
  process.exit(1);
}

console.log(`Testing Nest API with token (${token.length} chars)`);
console.log(`Camera UUID: ${cameraUuid}`);

const url = `https://nexusapi-us1.camera.home.nest.com/get_image?uuid=${cameraUuid}&width=1280`;

console.log(`URL: ${url}`);
console.log('');

// Test 1: With cztoken cookie
console.log('Test 1: Cookie: cztoken=...');
const options1 = {
  method: 'GET',
  headers: {
    'Cookie': `cztoken=${token}`,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Referer': 'https://home.nest.com/',
  }
};

https.get(url, options1, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type']}`);

  if (res.statusCode === 200) {
    let size = 0;
    res.on('data', (chunk) => {
      size += chunk.length;
    });
    res.on('end', () => {
      console.log(`✓ Success! Image size: ${size} bytes`);
      runTest2();
    });
  } else {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      console.log(`✗ Failed: ${body.substring(0, 200)}`);
      runTest2();
    });
  }
}).on('error', (err) => {
  console.error('✗ Request error:', err.message);
  runTest2();
});

// Test 2: With user_token cookie
function runTest2() {
  console.log('\nTest 2: Cookie: user_token=...');
  const options2 = {
    method: 'GET',
    headers: {
      'Cookie': `user_token=${token}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://home.nest.com/',
    }
  };

  https.get(url, options2, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);

    if (res.statusCode === 200) {
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
      });
      res.on('end', () => {
        console.log(`✓ Success! Image size: ${size} bytes`);
      });
    } else {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        console.log(`✗ Failed: ${body.substring(0, 200)}`);
      });
    }
  }).on('error', (err) => {
    console.error('✗ Request error:', err.message);
  });
}
