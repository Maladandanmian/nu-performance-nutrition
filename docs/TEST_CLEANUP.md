# Test Client Cleanup System

This document describes the automated test client cleanup system that prevents database pollution from test data.

## Overview

The test cleanup system automatically identifies and deletes test clients and their associated data (meals, drinks, body metrics, nutrition goals) after test completion.

## Components

### 1. Test Cleanup Utilities (`server/testCleanup.ts`)

Core utilities for identifying and deleting test clients:

- **`isTestClient(email: string)`**: Identifies test clients by email patterns
- **`deleteTestClient(clientId: number)`**: Deletes a single test client and all associated data
- **`findTestClients()`**: Finds all test clients in the database
- **`cleanupAllTestClients()`**: Deletes all test clients (use with caution)
- **`TestClientTracker`**: Helper class for tracking and cleaning up test clients in tests

### 2. Database Functions (`server/db.ts`)

Database helper functions for cleanup:

- **`deleteClientAndData(clientId: number)`**: Deletes a client and all associated data in the correct order
- **`deleteBodyMetric(metricId: number)`**: Deletes a single body metric
- **`deleteNutritionGoalByClientId(clientId: number)`**: Deletes nutrition goals for a client

### 3. Manual Cleanup Script (`scripts/cleanupTestClients.ts`)

A standalone script for manual cleanup of orphaned test data.

**Usage:**
```bash
pnpm cleanup:test-clients
```

## Test Client Identification

Test clients are identified by email patterns:

- Ends with `@test.com`
- Starts with `test`
- Contains `test` and ends with `@example.com`
- Contains `drinkedit`, `editdelete`, or `bevtest`

## Automated Cleanup in Tests

### Using TestClientTracker (Recommended)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { TestClientTracker } from './testCleanup';

describe('My Test Suite', () => {
  let testClientId: number;
  const tracker = new TestClientTracker();

  beforeAll(async () => {
    // Create test client
    const clientResult = await db.createClient({
      name: 'Test Client',
      email: 'test@test.com',
      pin: '123456',
      trainerId: 1,
    });
    testClientId = Number(clientResult[0].insertId);
    tracker.track(testClientId); // Track for cleanup
  });

  afterAll(async () => {
    await tracker.cleanup(); // Automatic cleanup
  });

  // Your tests here...
});
```

### Using deleteClientAndData Directly

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('My Test Suite', () => {
  let testClientId: number;

  beforeAll(async () => {
    // Create test client
    const clientResult = await db.createClient({
      name: 'Test Client',
      email: 'test@test.com',
      pin: '123456',
      trainerId: 1,
    });
    testClientId = Number(clientResult[0].insertId);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testClientId) {
      try {
        await db.deleteClientAndData(testClientId);
      } catch (error) {
        console.error('Failed to clean up test client:', error);
      }
    }
  });

  // Your tests here...
});
```

## Manual Cleanup

If tests fail or are interrupted, test clients may remain in the database. Use the manual cleanup script to remove them:

```bash
pnpm cleanup:test-clients
```

**Example output:**
```
============================================================
Test Client Cleanup Script
============================================================

Finding test clients...

Found 8 test client(s):

  1. Test Client for Edit/Delete (editdelete1769054449254@example.com) - ID: 480032
  2. Test Client for Beverage (bevtest1769054451495@example.com) - ID: 480033
  3. Drink Edit Test Client (drinkedit@test.com) - ID: 540173
  ...

------------------------------------------------------------
Starting cleanup...

[TestCleanup] Starting cleanup of all test clients...
[TestCleanup] Found 8 test clients to delete
[TestCleanup] Deleting test client 480032 and all associated data...
[TestCleanup] ✅ Successfully deleted test client 480032
...

============================================================
✅ Cleanup complete: 8 of 8 test clients deleted
============================================================
```

## Best Practices

1. **Always use test email patterns**: Ensure test clients use email addresses matching the patterns in `isTestClient()`
2. **Use afterAll hooks**: Always add cleanup in `afterAll` hooks to ensure cleanup runs even if tests fail
3. **Use unique identifiers**: Use timestamps or random numbers in test client emails to avoid conflicts
4. **Run manual cleanup periodically**: If you notice test clients accumulating, run `pnpm cleanup:test-clients`
5. **Check cleanup logs**: Review test output to verify cleanup is working correctly

## Cleanup Order

Data is deleted in this order to respect foreign key constraints:

1. Body metrics
2. Drinks
3. Meals
4. Nutrition goals
5. Client

## Troubleshooting

### Test clients not being deleted

- Check that the email matches one of the patterns in `isTestClient()`
- Verify that `afterAll` hook is being called (check test output)
- Run manual cleanup script: `pnpm cleanup:test-clients`

### Foreign key constraint errors

- Ensure `deleteClientAndData` is being used instead of individual delete functions
- Check that the deletion order is correct (see Cleanup Order above)

### Tests failing with "client not found"

- Ensure cleanup is in `afterAll`, not `afterEach` (unless you want per-test cleanup)
- Check that client creation is in `beforeAll`, not `beforeEach`

## Adding New Test Patterns

To add new test client identification patterns, edit `server/testCleanup.ts`:

```typescript
export function isTestClient(email: string): boolean {
  const testPatterns = [
    /@test\.com$/i,
    /^test/i,
    /test.*@example\.com$/i,
    /drinkedit/i,
    /editdelete/i,
    /bevtest/i,
    /yournewpattern/i, // Add your pattern here
  ];
  
  return testPatterns.some(pattern => pattern.test(email));
}
```
