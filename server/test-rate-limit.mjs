/**
 * Test script to verify rate limiting works
 * Simulates 5+ failed login attempts from the same IP
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_IP = '192.168.1.100'; // Test IP address
const WRONG_PIN = '000000'; // Invalid PIN

async function testRateLimiting() {
  console.log('=== Rate Limiting Test ===\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test IP: ${TEST_IP}`);
  console.log(`Testing PIN: ${WRONG_PIN}\n`);

  const results = [];

  // Attempt 5 failed logins
  for (let i = 1; i <= 6; i++) {
    console.log(`\nAttempt ${i}:`);
    
    try {
      const response = await fetch(`${API_URL}/api/trpc/auth.loginWithPIN`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': TEST_IP, // Simulate request from test IP
        },
        body: JSON.stringify({
          json: { pin: WRONG_PIN },
        }),
      });

      const data = await response.json();
      
      // Check if rate limited
      if (response.status === 429 || (data.error && data.error.code === 'TOO_MANY_REQUESTS')) {
        console.log(`  ✓ Rate limited! Message: ${data.error?.message || 'Too many requests'}`);
        results.push({ attempt: i, status: 'RATE_LIMITED', code: data.error?.code });
      } else if (response.status === 401 || (data.error && data.error.code === 'UNAUTHORIZED')) {
        console.log(`  ✓ Invalid PIN rejected`);
        results.push({ attempt: i, status: 'INVALID_PIN', code: data.error?.code });
      } else {
        console.log(`  ? Unexpected response: ${response.status}`);
        console.log(`    ${JSON.stringify(data).substring(0, 100)}`);
        results.push({ attempt: i, status: 'UNEXPECTED', code: response.status });
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ attempt: i, status: 'ERROR', error: error.message });
    }
  }

  // Summary
  console.log('\n=== Test Summary ===\n');
  const rateLimited = results.filter(r => r.status === 'RATE_LIMITED').length;
  const invalidPin = results.filter(r => r.status === 'INVALID_PIN').length;
  
  console.log(`Total attempts: ${results.length}`);
  console.log(`Invalid PIN responses: ${invalidPin}`);
  console.log(`Rate limited responses: ${rateLimited}`);
  
  if (rateLimited > 0) {
    console.log('\n✓ Rate limiting is working! Account was locked after multiple failed attempts.');
    return true;
  } else {
    console.log('\n✗ Rate limiting did not trigger. Check if rate limit is enabled.');
    return false;
  }
}

testRateLimiting().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
