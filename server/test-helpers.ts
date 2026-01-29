/**
 * Test helpers for authenticating with the dedicated test account
 * 
 * Test Account Details:
 * - PIN: 098765
 * - Purpose: Isolated test environment to prevent polluting production data
 * - All automated tests should use this account
 */

import * as db from './db';
import type { TrpcContext } from './_core/context';
import type { Response } from 'express';
import { TEST_CLIENT_ID } from './testSetup';

/**
 * Test account PIN - use this account for all automated tests
 */
export const TEST_ACCOUNT_PIN = '098765';

/**
 * Production account PIN - DO NOT use in tests
 */
export const PRODUCTION_ACCOUNT_PIN = '222222';

/**
 * Get or create the test client account (PIN 098765)
 * Returns the client ID for use in tests
 */
export async function getTestClientId(): Promise<number> {
  // Use the centralized TEST_CLIENT_ID from testSetup.ts
  // This ensures all tests use the same client ID (990036)
  return TEST_CLIENT_ID;
}

/**
 * Create a test tRPC context for the test account
 * Use this in tests that need authentication
 */
export async function createTestContext(): Promise<TrpcContext> {
  const testClient = await db.getClientByPIN(TEST_ACCOUNT_PIN);
  
  if (!testClient) {
    throw new Error(
      `Test client with PIN ${TEST_ACCOUNT_PIN} not found. ` +
      `Please create a test client with PIN ${TEST_ACCOUNT_PIN} in the UI before running tests.`
    );
  }

  // Get the trainer (owner) of the test client
  // Query users table directly by trainerId
  const { getDb } = await import('./db');
  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error('Database not available');
  }
  
  const { users } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const trainerResults = await dbInstance.select().from(users).where(eq(users.id, testClient.trainerId)).limit(1);
  const trainer = trainerResults[0];
  
  if (!trainer) {
    throw new Error(`Trainer for test client not found (trainerId: ${testClient.trainerId})`);
  }

  const ctx: TrpcContext = {
    user: {
      id: trainer.id,
      openId: trainer.openId,
      email: trainer.email || '',
      name: trainer.name,
      loginMethod: 'manus',
      role: trainer.role as 'admin' | 'user',
      createdAt: trainer.createdAt,
      updatedAt: trainer.updatedAt,
      lastSignedIn: trainer.lastSignedIn || new Date(),
    },
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as Response,
  };

  return ctx;
}

/**
 * Clean up test data created during tests
 * Call this in afterEach or afterAll hooks
 */
export async function cleanupTestData(clientId: number) {
  try {
    // Get test client to verify it's the test account
    const client = await db.getClientById(clientId);
    
    if (!client) {
      console.warn(`Client ${clientId} not found during cleanup`);
      return;
    }

    // Verify this is the test client by ID (PIN is hashed, so we can't compare it directly)
    if (clientId !== TEST_CLIENT_ID) {
      throw new Error(
        `Attempted to cleanup non-test client (ID: ${clientId}). ` +
        `Only test account (ID: ${TEST_CLIENT_ID}) data can be auto-cleaned.`
      );
    }

    // Delete test data using existing db functions
    // Note: We don't delete the client itself, just the test data
    // Get all meals and drinks for this client and delete them
    const clientMeals = await db.getMealsByClientId(clientId);
    for (const meal of clientMeals) {
      await db.deleteMeal(meal.id);
    }
    
    const clientDrinks = await db.getDrinksByClientId(clientId);
    for (const drink of clientDrinks) {
      await db.deleteDrink(drink.id);
    }
    
    const clientMetrics = await db.getBodyMetricsByClientId(clientId);
    for (const metric of clientMetrics) {
      await db.deleteBodyMetric(metric.id);
    }

    console.log(`Cleaned up test data for client ${clientId} (PIN: ${TEST_ACCOUNT_PIN})`);
  } catch (error) {
    console.error('Failed to clean up test data:', error);
    throw error;
  }
}

/**
 * Verify we're using the test account, not production
 * Call this at the start of tests that modify data
 */
export async function verifyTestAccount(clientId: number) {
  const client = await db.getClientById(clientId);
  
  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  // Verify using client ID since PIN is hashed
  if (clientId !== TEST_CLIENT_ID) {
    throw new Error(
      `DANGER: Test is attempting to use non-test client (ID: ${clientId})! ` +
      `Tests must use test account (ID: ${TEST_CLIENT_ID}, PIN: ${TEST_ACCOUNT_PIN}) only.`
    );
  }
}
