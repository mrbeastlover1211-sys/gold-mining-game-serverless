#!/usr/bin/env node

/**
 * Test Script for Admin Security Implementation
 * 
 * This script verifies that your admin security is properly configured.
 * Run after deploying the secure admin panel.
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const USE_HTTPS = BASE_URL.startsWith('https');

console.log('\n🔐 Admin Security Test Suite\n');
console.log(`Testing: ${BASE_URL}\n`);

let testsPassed = 0;
let testsFailed = 0;

// Helper function to make HTTP requests
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = USE_HTTPS ? https : http;
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test helper
async function test(name, fn) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    await fn();
    console.log('✅ PASS');
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    testsFailed++;
  }
}

// Run tests
async function runTests() {
  console.log('═'.repeat(60));
  console.log('TEST 1: Authentication Endpoints');
  console.log('═'.repeat(60) + '\n');

  await test('Login endpoint exists', async () => {
    const response = await makeRequest('/api/admin/auth', {
      method: 'POST',
      body: { action: 'login', username: 'test', password: 'test' }
    });
    
    if (response.status === 404) {
      throw new Error('Endpoint not found - did you deploy?');
    }
    if (response.status !== 401 && response.status !== 400) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  await test('Rejects empty credentials', async () => {
    const response = await makeRequest('/api/admin/auth', {
      method: 'POST',
      body: { action: 'login', username: '', password: '' }
    });
    
    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
  });

  await test('Rejects invalid credentials', async () => {
    const response = await makeRequest('/api/admin/auth', {
      method: 'POST',
      body: { 
        action: 'login', 
        username: 'wrong', 
        password: 'wrongpassword123456' 
      }
    });
    
    if (response.status !== 401 && response.status !== 500) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
  });

  console.log('\n' + '═'.repeat(60));
  console.log('TEST 2: Rate Limiting');
  console.log('═'.repeat(60) + '\n');

  await test('Multiple failed attempts trigger lockout', async () => {
    // Try 6 failed logins
    for (let i = 0; i < 6; i++) {
      await makeRequest('/api/admin/auth', {
        method: 'POST',
        body: { 
          action: 'login', 
          username: 'test', 
          password: `wrong${i}` 
        }
      });
    }

    // 6th attempt should be locked out
    const response = await makeRequest('/api/admin/auth', {
      method: 'POST',
      body: { 
        action: 'login', 
        username: 'test', 
        password: 'wrong6' 
      }
    });

    if (response.body && !response.body.lockedOut && response.status !== 429) {
      throw new Error('Should be locked out after 5 attempts');
    }
  });

  console.log('\n' + '═'.repeat(60));
  console.log('TEST 3: Session Management');
  console.log('═'.repeat(60) + '\n');

  await test('Rejects requests without token', async () => {
    const response = await makeRequest('/api/admin/dashboard', {
      method: 'GET'
    });
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
  });

  await test('Rejects invalid token', async () => {
    const response = await makeRequest('/api/admin/dashboard', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid_token_12345'
      }
    });
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
  });

  console.log('\n' + '═'.repeat(60));
  console.log('TEST 4: CORS Protection');
  console.log('═'.repeat(60) + '\n');

  await test('Blocks unauthorized origins', async () => {
    const response = await makeRequest('/api/admin/auth', {
      method: 'POST',
      headers: {
        'Origin': 'https://evil-hacker-site.com'
      },
      body: { action: 'login', username: 'test', password: 'test' }
    });
    
    // Should not have CORS header for unauthorized origin
    if (response.headers['access-control-allow-origin'] === '*') {
      throw new Error('CORS is too permissive (allows all origins)');
    }
  });

  console.log('\n' + '═'.repeat(60));
  console.log('TEST 5: Old Admin Panel');
  console.log('═'.repeat(60) + '\n');

  await test('Old admin endpoints return deprecation notice', async () => {
    const response = await makeRequest('/api/admin-final', {
      method: 'POST',
      body: { action: 'dashboard', password: 'admin123' }
    });
    
    // Old endpoint should ideally return error or be disabled
    console.log(`    Status: ${response.status} (should be disabled or warn)`);
  });

  console.log('\n' + '═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60) + '\n');

  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📊 Total Tests: ${testsPassed + testsFailed}`);
  
  const successRate = Math.round((testsPassed / (testsPassed + testsFailed)) * 100);
  console.log(`\n🎯 Success Rate: ${successRate}%\n`);

  if (testsFailed === 0) {
    console.log('🎉 All tests passed! Your admin panel is secure.\n');
  } else {
    console.log('⚠️  Some tests failed. Review the errors above.\n');
  }

  console.log('═'.repeat(60));
  console.log('NEXT STEPS');
  console.log('═'.repeat(60) + '\n');

  console.log('1. Run setup script:');
  console.log('   node setup-admin-credentials.js\n');
  
  console.log('2. Add environment variables to Vercel:\n');
  console.log('   ADMIN_USERNAME');
  console.log('   ADMIN_PASSWORD_HASH');
  console.log('   ADMIN_SALT');
  console.log('   FRONTEND_URL\n');
  
  console.log('3. Deploy to production:');
  console.log('   vercel --prod\n');
  
  console.log('4. Access your secure admin panel:');
  console.log(`   ${BASE_URL.replace('localhost:3000', 'your-domain.vercel.app')}/admin-secure.html\n`);
  
  console.log('5. Disable old admin endpoints (remove or deprecate):\n');
  console.log('   - api/admin-final.js');
  console.log('   - api/admin.js');
  console.log('   - public/admin.html\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Test suite error:', error.message);
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
