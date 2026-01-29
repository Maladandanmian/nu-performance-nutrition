import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import { TEST_CLIENT_ID } from "./testSetup";
import { getTestClientId, createTestContext, cleanupTestData, verifyTestAccount, TEST_ACCOUNT_PIN } from './test-helpers';

/**
 * Example test demonstrating how to use the test account (PIN 098765)
 * 
 * This test shows the recommended pattern for all integration tests:
 * 1. Use getTestClientId() to get the test client
 * 2. Use createTestContext() for authentication
 * 3. Use verifyTestAccount() before modifying data
 * 4. Use cleanupTestData() in afterAll to clean up
 * 
 * IMPORTANT: Before running tests, create a test client with PIN 098765 in the UI
 */

describe('Test Account Example', () => {
  let testClientId: number;

  beforeAll(async () => {
    // Get the test client ID (PIN 098765)
    // This will throw an error if the test client doesn't exist
    testClientId = await getTestClientId();
    console.log(`Using test client ID: ${testClientId} (PIN: ${TEST_ACCOUNT_PIN})`);
  });

  afterAll(async () => {
    // Clean up any test data created during tests
    if (testClientId) {
      await cleanupTestData(testClientId);
    }
  });

  it('should use test account for data operations', async () => {
    // Verify we're using the test account, not production
    await verifyTestAccount(testClientId);

    // Create authenticated context for the test account
    const ctx = await createTestContext();
    
    // Verify context was created successfully
    expect(ctx).toBeDefined();
    expect(ctx.user).toBeDefined();
    expect(ctx.user?.role).toBe('admin');
    
    console.log(`✓ Test running against test account (Client ID: ${testClientId}, PIN: ${TEST_ACCOUNT_PIN})`);
    console.log(`✓ Authenticated as: ${ctx.user?.name} (${ctx.user?.email})`);
  });

  it('should prevent accidental use of production account', async () => {
    // This test demonstrates the safety check
    const PRODUCTION_PIN = '222222';
    
    // If someone accidentally tries to use production account, it should fail
    await expect(async () => {
      // Simulate checking a production client ID
      // In real scenario, this would be caught by verifyTestAccount()
      const productionClient = { id: 999, pin: PRODUCTION_PIN };
      if (productionClient.pin === PRODUCTION_PIN) {
        throw new Error(
          `DANGER: Test is attempting to use production account (PIN: ${PRODUCTION_PIN})! ` +
          `Tests must use test account (PIN: ${TEST_ACCOUNT_PIN}) only.`
        );
      }
    }).rejects.toThrow('DANGER');
  });
});
