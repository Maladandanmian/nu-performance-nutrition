/**
 * Test Helpers
 * ============
 * 
 * CRITICAL PROTOCOL — READ BEFORE WRITING ANY TEST OR DATABASE OPERATION
 * -----------------------------------------------------------------------
 * 
 * Andy Knight's account (trainer ID: 1) is the DESIGNATED TEST ACCOUNT.
 * All test clients and data must be created under trainerId = 1.
 * 
 * Luke's account is PRODUCTION. His trainer ID must NEVER appear in any
 * DELETE, UPDATE, or INSERT during development or testing.
 * 
 * The ONLY safe cleanup pattern:
 *   DELETE FROM clients WHERE trainerId = 1 AND id != 990036
 * 
 * The permanent test client (ID 990036, andy@andyknight.asia) must never
 * be deleted.
 */

import * as db from './db';
import type { TrpcContext } from './_core/context';
import type { Response } from 'express';
import { TEST_CLIENT_ID, ANDY_TRAINER_ID, getTestCleanupWhereClause } from './testSetup';

/**
 * Get the permanent test client record.
 * Returns the client ID for use in tests.
 */
export async function getTestClientId(): Promise<number> {
  return TEST_CLIENT_ID;
}

/**
 * Create a test tRPC context authenticated as Andy Knight (trainer ID: 1).
 * Use this in all tests that require trainer-level authentication.
 */
export async function createTestContext(): Promise<TrpcContext> {
  const testClient = await db.getClientById(TEST_CLIENT_ID);

  if (!testClient) {
    throw new Error(
      `Permanent test client (ID: ${TEST_CLIENT_ID}) not found. ` +
      `This client must always exist — do not delete it.`
    );
  }

  const { getDb } = await import('./db');
  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error('Database not available');
  }

  const { users } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const trainerResults = await dbInstance
    .select()
    .from(users)
    .where(eq(users.id, ANDY_TRAINER_ID))
    .limit(1);
  const trainer = trainerResults[0];

  if (!trainer) {
    throw new Error(`Andy Knight (trainer ID: ${ANDY_TRAINER_ID}) not found in users table`);
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
 * Clean up test data for the permanent test client.
 * Only clears logged data (meals, drinks, metrics) — never deletes the client itself.
 */
export async function cleanupTestData(clientId: number) {
  if (clientId !== TEST_CLIENT_ID) {
    throw new Error(
      `BLOCKED: Attempted to clean up client ID ${clientId}. ` +
      `Only the permanent test client (ID: ${TEST_CLIENT_ID}) can be cleaned up via this function. ` +
      `This safeguard prevents accidental deletion of production data.`
    );
  }

  try {
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

    console.log(`Cleaned up test data for permanent test client (ID: ${clientId})`);
  } catch (error) {
    console.error('Failed to clean up test data:', error);
    throw error;
  }
}

/**
 * Delete all temporary test clients created under Andy's trainer account.
 * The permanent test client (ID: 990036) is always preserved.
 * 
 * Safe cleanup query pattern — this is the ONLY permitted way to bulk-delete test clients.
 */
export async function cleanupTestClients() {
  const { getDb } = await import('./db');
  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error('Database not available');
  }

  const { clients } = await import('../drizzle/schema');
  const { and, eq, ne } = await import('drizzle-orm');

  // Safe pattern: only delete clients under Andy's trainer ID, never the permanent test client
  const deleted = await dbInstance
    .delete(clients)
    .where(
      and(
        eq(clients.trainerId, ANDY_TRAINER_ID),
        ne(clients.id, TEST_CLIENT_ID)
      )
    );

  console.log(`Cleaned up test clients under trainer ID ${ANDY_TRAINER_ID} (preserved ID: ${TEST_CLIENT_ID})`);
  return deleted;
}

/**
 * Verify a client ID belongs to the test account before any operation.
 * Call this at the start of any test that modifies client data.
 */
export async function verifyTestAccount(clientId: number) {
  if (clientId !== TEST_CLIENT_ID) {
    throw new Error(
      `BLOCKED: Test attempted to operate on client ID ${clientId}. ` +
      `Tests must only use the permanent test client (ID: ${TEST_CLIENT_ID}).`
    );
  }
}

// Re-export for convenience
export { getTestCleanupWhereClause, ANDY_TRAINER_ID, TEST_CLIENT_ID };
