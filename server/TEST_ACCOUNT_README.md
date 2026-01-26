# Test Account System

This document explains how to use the dedicated test account (PIN 098765) for automated testing to prevent polluting production data.

## Overview

**Problem:** Running tests against production accounts (like PIN 222222) creates test data that clutters the real user interface and makes it hard to distinguish between real and test data.

**Solution:** All automated tests use a dedicated test client with PIN **098765**. Test data is automatically cleaned up after each test run.

## Setup

### One-Time Setup (Already Completed)

1. Create a test client in the UI:
   - Name: "Test Account" (or any name)
   - PIN: **098765**
   - Email: test@example.com (optional)
   - Set up nutrition goals (any values)

2. The test client is now available for all tests (Client ID: 630001)

## Usage in Tests

### Basic Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import { 
  getTestClientId, 
  createTestContext, 
  cleanupTestData, 
  verifyTestAccount 
} from './test-helpers';

describe('My Feature Tests', () => {
  let testClientId: number;

  beforeAll(async () => {
    // Get the test client ID (PIN 098765)
    testClientId = await getTestClientId();
  });

  afterAll(async () => {
    // Clean up test data
    if (testClientId) {
      await cleanupTestData(testClientId);
    }
  });

  it('should do something with test data', async () => {
    // Verify we're using test account
    await verifyTestAccount(testClientId);

    // Create authenticated context
    const ctx = await createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Now safely call procedures that modify data
    // ...
  });
});
```

### Available Helper Functions

#### `getTestClientId(): Promise<number>`

Returns the test client ID (PIN 098765). Throws an error if the test client doesn't exist.

```typescript
const testClientId = await getTestClientId();
// Returns: 630001
```

#### `createTestContext(): Promise<TrpcContext>`

Creates an authenticated tRPC context for the test account's trainer.

```typescript
const ctx = await createTestContext();
const caller = appRouter.createCaller(ctx);
```

#### `verifyTestAccount(clientId: number): Promise<void>`

Verifies that the given client ID belongs to the test account. Throws an error if it's the production account (PIN 222222).

```typescript
await verifyTestAccount(testClientId); // ✓ Safe
await verifyTestAccount(productionClientId); // ✗ Throws error
```

#### `cleanupTestData(clientId: number): Promise<void>`

Deletes all test data (meals, drinks, body metrics) for the test client. **Does NOT delete the client itself.**

```typescript
await cleanupTestData(testClientId);
// Deletes: meals, drinks, body_metrics
// Keeps: client record, nutrition goals
```

## Safety Features

### 1. Production Account Protection

The system prevents accidental use of production accounts:

```typescript
// If you try to clean up production data:
await cleanupTestData(productionClientId);
// ✗ Throws: "Attempted to cleanup non-test client (PIN: 222222)"
```

### 2. Test Account Verification

Always call `verifyTestAccount()` before modifying data:

```typescript
await verifyTestAccount(clientId);
// ✓ Passes for PIN 098765
// ✗ Throws error for PIN 222222
```

### 3. Automatic Cleanup

Test data is automatically cleaned up in `afterAll` hooks, preventing accumulation of test records.

## Constants

```typescript
TEST_ACCOUNT_PIN = '098765'        // Use this for tests
PRODUCTION_ACCOUNT_PIN = '222222'  // DO NOT use in tests
```

## Example: Full Test Suite

See `server/test-account-example.test.ts` for a complete working example.

## Migrating Existing Tests

To migrate an existing test to use the test account:

### Before (Creates Test Client Every Time)

```typescript
beforeAll(async () => {
  // Create test trainer
  const trainerOpenId = `test-trainer-${Date.now()}`;
  await db.upsertUser({ openId: trainerOpenId, ... });
  const trainer = await db.getUserByOpenId(trainerOpenId);
  testTrainerId = trainer.id;

  // Create test client
  const clientResult = await db.createClient({
    trainerId: testTrainerId,
    pin: `${Math.floor(100000 + Math.random() * 900000)}`,
    ...
  });
  testClientId = Number(clientResult[0].insertId);
});

afterAll(async () => {
  await db.deleteClientAndData(testClientId);
});
```

### After (Uses Shared Test Account)

```typescript
import { getTestClientId, createTestContext, cleanupTestData } from './test-helpers';

beforeAll(async () => {
  testClientId = await getTestClientId();
});

afterAll(async () => {
  await cleanupTestData(testClientId);
});
```

**Benefits:**
- ✅ Faster tests (no client creation/deletion)
- ✅ No production data pollution
- ✅ Consistent test environment
- ✅ Automatic cleanup

## Troubleshooting

### Error: "Test client with PIN 098765 not found"

**Solution:** Create the test client in the UI first (see Setup section).

### Error: "DANGER: Test is attempting to use production account"

**Solution:** You're passing the wrong client ID. Use `getTestClientId()` instead of hardcoding IDs.

### Test data not cleaning up

**Solution:** Ensure you call `cleanupTestData()` in `afterAll` hook:

```typescript
afterAll(async () => {
  if (testClientId) {
    await cleanupTestData(testClientId);
  }
});
```

## Best Practices

1. **Always use `getTestClientId()`** - Never hardcode client IDs
2. **Always call `verifyTestAccount()`** - Before modifying data
3. **Always clean up** - Use `cleanupTestData()` in `afterAll`
4. **Never delete the test client** - Only delete test data, not the client itself
5. **Document test data** - Add comments explaining what test data you're creating

## Future Improvements

- Add support for multiple test accounts (e.g., different nutrition goals)
- Add test data seeding helpers for common scenarios
- Add test data snapshots for regression testing
