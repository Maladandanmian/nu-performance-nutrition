/**
 * Test Setup Configuration
 * ========================
 * 
 * CRITICAL PROTOCOL — READ BEFORE WRITING ANY TEST OR DATABASE OPERATION
 * -----------------------------------------------------------------------
 * 
 * Andy Knight's account (trainer ID: 1, email: andy@andyknight.asia) is the
 * DESIGNATED TEST ACCOUNT. All test clients, sessions, packages, and data
 * created during development MUST be assigned to trainer ID 1.
 * 
 * Luke's account is the PRODUCTION ACCOUNT. His trainer ID must NEVER be
 * referenced in any DELETE, UPDATE, or INSERT operation during development.
 * 
 * SAFE CLEANUP RULE — the only permitted cleanup query pattern is:
 *   DELETE FROM clients
 *   WHERE trainerId = ANDY_TRAINER_ID
 *   AND id != PERMANENT_TEST_CLIENT_ID
 * 
 * This structurally prevents any production data from being touched,
 * regardless of how the query is written.
 * 
 * DO NOT use blanket DELETE queries like:
 *   DELETE FROM clients WHERE email != 'x'   ← FORBIDDEN: touches all trainers
 *   DELETE FROM clients WHERE name LIKE '%test%'  ← FORBIDDEN: too broad
 * 
 * Permanent test client: ID 990036 (TEST CLIENT / andy@andyknight.asia)
 * This client must never be deleted.
 */

/** Andy Knight's trainer ID — the designated test account */
export const ANDY_TRAINER_ID = 1;

/** The permanent test client ID — must never be deleted */
export const TEST_CLIENT_ID = 990036;

/** Andy's email — the protected permanent test client email */
export const ANDY_TEST_EMAIL = 'andy@andyknight.asia';

/**
 * Helper to get test client ID
 * Use this in tests instead of hardcoding client IDs
 */
export function getTestClientId(): number {
  return TEST_CLIENT_ID;
}

/**
 * Returns the safe SQL WHERE clause for test client cleanup.
 * Always use this pattern — never write ad-hoc DELETE queries.
 * 
 * Usage:
 *   DELETE FROM clients WHERE ${getTestCleanupWhereClause()}
 */
export function getTestCleanupWhereClause(): string {
  return `trainerId = ${ANDY_TRAINER_ID} AND id != ${TEST_CLIENT_ID}`;
}
