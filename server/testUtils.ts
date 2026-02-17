/**
 * Shared test utilities
 * Provides helper functions for tests to avoid creating duplicate test data
 */

import * as db from "./db";

/**
 * Get the existing TEST CLIENT account for testing
 * This ensures all tests use the same designated test client instead of creating new ones
 * 
 * @returns The TEST CLIENT record from the database
 * @throws Error if TEST CLIENT doesn't exist
 */
export async function getTestClient() {
  const clients = await db.getAllClients();
  const testClient = clients.find(
    (c: any) => c.name === "TEST CLIENT" || c.email === "andy@andyknight.asia"
  );

  if (!testClient) {
    throw new Error(
      "TEST CLIENT not found in database. Please ensure the TEST CLIENT account exists before running tests."
    );
  }

  return testClient;
}

/**
 * Get the trainer ID associated with the TEST CLIENT
 * 
 * @returns The trainer ID for the TEST CLIENT
 */
export async function getTestTrainerId() {
  const testClient = await getTestClient();
  return testClient.trainerId;
}
