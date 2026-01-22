/**
 * Test Cleanup Utilities
 * 
 * Provides automated cleanup of test clients and their associated data
 * to prevent database pollution during testing.
 */

import * as db from './db';

/**
 * Identifies test clients by email pattern
 * Test clients have emails matching:
 * - *@test.com
 * - test*@*
 * - *test*@example.com
 */
export function isTestClient(email: string): boolean {
  const testPatterns = [
    /@test\.com$/i,           // ends with @test.com
    /^test/i,                  // starts with "test"
    /test.*@example\.com$/i,   // contains "test" and ends with @example.com
    /drinkedit/i,              // drink edit test clients
    /editdelete/i,             // edit/delete test clients
    /bevtest/i,                // beverage test clients
  ];
  
  return testPatterns.some(pattern => pattern.test(email));
}

/**
 * Delete a single test client and all associated data
 * Cascades to: meals, drinks, body metrics, nutrition goals
 */
export async function deleteTestClient(clientId: number): Promise<void> {
  console.log(`[TestCleanup] Deleting test client ${clientId} and all associated data...`);
  
  try {
    // Get client info for logging
    const clients = await db.getClientsByTrainerId(1); // Assuming trainer ID 1 for tests
    const client = clients.find(c => c.id === clientId);
    
    if (client) {
      console.log(`[TestCleanup] Found client: ${client.name} (${client.email})`);
    }
    
    // Delete associated data (order matters due to foreign key constraints)
    // 1. Delete meals (which will cascade to meal components if configured)
    const meals = await db.getMealsByClientId(clientId);
    for (const meal of meals) {
      await db.deleteMeal(meal.id);
    }
    console.log(`[TestCleanup] Deleted ${meals.length} meals`);
    
    // 2. Delete drinks
    const drinks = await db.getDrinksByClientId(clientId);
    for (const drink of drinks) {
      await db.deleteDrink(drink.id);
    }
    console.log(`[TestCleanup] Deleted ${drinks.length} drinks`);
    
    // 3. Delete body metrics
    const metrics = await db.getBodyMetricsByClientId(clientId);
    for (const metric of metrics) {
      await db.deleteBodyMetric(metric.id);
    }
    console.log(`[TestCleanup] Deleted ${metrics.length} body metrics`);
    
    // 4. Delete nutrition goals
    await db.deleteNutritionGoalByClientId(clientId);
    console.log(`[TestCleanup] Deleted nutrition goals`);
    
    // 5. Finally delete the client
    await db.deleteClient(clientId);
    console.log(`[TestCleanup] ✅ Successfully deleted test client ${clientId}`);
    
  } catch (error) {
    console.error(`[TestCleanup] ❌ Error deleting test client ${clientId}:`, error);
    throw error;
  }
}

/**
 * Find all test clients in the database
 */
export async function findTestClients(): Promise<Array<{ id: number; name: string; email: string }>> {
  try {
    // Get all clients (assuming trainer ID 1 for tests)
    const allClients = await db.getClientsByTrainerId(1);
    
    // Filter to only test clients
    const testClients = allClients.filter(client => 
      client.email && isTestClient(client.email)
    );
    
    return testClients.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email || 'no-email',
    }));
  } catch (error) {
    console.error('[TestCleanup] Error finding test clients:', error);
    return [];
  }
}

/**
 * Delete all test clients and their associated data
 * Use with caution - this will delete ALL clients matching test patterns
 */
export async function cleanupAllTestClients(): Promise<number> {
  console.log('[TestCleanup] Starting cleanup of all test clients...');
  
  const testClients = await findTestClients();
  console.log(`[TestCleanup] Found ${testClients.length} test clients to delete`);
  
  let deletedCount = 0;
  
  for (const client of testClients) {
    try {
      await deleteTestClient(client.id);
      deletedCount++;
    } catch (error) {
      console.error(`[TestCleanup] Failed to delete client ${client.id} (${client.email}):`, error);
    }
  }
  
  console.log(`[TestCleanup] ✅ Cleanup complete: deleted ${deletedCount} of ${testClients.length} test clients`);
  return deletedCount;
}

/**
 * Cleanup helper for use in Vitest afterAll hooks
 * Tracks client IDs created during test and deletes them after
 */
export class TestClientTracker {
  private clientIds: number[] = [];
  
  /**
   * Register a client ID for cleanup
   */
  track(clientId: number): void {
    this.clientIds.push(clientId);
  }
  
  /**
   * Clean up all tracked clients
   * Call this in afterAll() hook
   */
  async cleanup(): Promise<void> {
    if (this.clientIds.length === 0) {
      return;
    }
    
    console.log(`[TestClientTracker] Cleaning up ${this.clientIds.length} test clients...`);
    
    for (const clientId of this.clientIds) {
      try {
        await deleteTestClient(clientId);
      } catch (error) {
        console.error(`[TestClientTracker] Failed to cleanup client ${clientId}:`, error);
      }
    }
    
    this.clientIds = [];
  }
}
