/**
 * Test Setup Configuration
 * 
 * All vitest tests should use the dedicated test client (PIN 098765)
 * to prevent test data from polluting production accounts.
 * 
 * Test client ID: 630001 (in Andy Knight's account)
 * PIN: 098765
 */

export const TEST_CLIENT_ID = 630001;

/**
 * Helper to get test client ID
 * Use this in tests instead of hardcoding client IDs
 */
export function getTestClientId(): number {
  return TEST_CLIENT_ID;
}
