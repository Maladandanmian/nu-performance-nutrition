# Testing Guidelines

## Overview

This document outlines the proper testing workflow for the Nu Performance Nutrition application to prevent test data pollution in the production database.

## Core Principles

### 1. Never Create New Test Clients

**All tests must use the existing TEST CLIENT account.**

- **Designated Test Client**: "TEST CLIENT" (email: andy@andyknight.asia)
- **Never** create new client records in tests
- Use the `getTestClient()` helper function from `server/testUtils.ts`

### 2. Use Shared Test Utilities

Import and use the test utilities to access the designated test client:

```typescript
import { getTestClient, getTestTrainerId } from "./testUtils";

describe("My Feature Tests", () => {
  let clientId: number;
  let trainerId: number;

  beforeAll(async () => {
    const testClient = await getTestClient();
    clientId = testClient.id;
    trainerId = await getTestTrainerId();
  });

  // Your tests here...
});
```

### 3. Clean Up Test Data

If your tests create additional records (meals, wellness submissions, etc.), clean them up in `afterAll`:

```typescript
afterAll(async () => {
  // Clean up any test data created during tests
  await db.deleteMealsByClientId(clientId);
  await db.deleteWellnessSubmissionsByClientId(clientId);
});
```

### 4. Avoid Database Pollution

- Do not create test users, clients, or trainers
- Do not leave test data in the database after tests complete
- Use the existing TEST CLIENT for all client-related tests
- Use the TEST CLIENT's trainer for all trainer-related tests

## Migration Guide

If you have existing tests that create clients, update them as follows:

### Before (❌ Creates test data):

```typescript
beforeAll(async () => {
  const [clientResult] = await db.createClient({
    trainerId: 1,
    name: "Test Client",
    email: "test@example.com",
  });
  clientId = clientResult.insertId;
});
```

### After (✅ Uses existing TEST CLIENT):

```typescript
import { getTestClient, getTestTrainerId } from "./testUtils";

beforeAll(async () => {
  const testClient = await getTestClient();
  clientId = testClient.id;
  trainerId = await getTestTrainerId();
});
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/myFeature.test.ts

# Run tests in watch mode
pnpm test --watch
```

## Test Data Management

The TEST CLIENT account should have:

- A valid nutrition goal
- Sample meal data (optional, for testing meal-related features)
- Sample wellness submissions (optional, for testing wellness features)
- Sample VO2 Max tests (optional, for testing VO2 Max features)

If the TEST CLIENT is missing required data for your tests, create it in the `beforeAll` hook and clean it up in `afterAll`.

## Common Pitfalls

1. **Creating new clients in tests** - Always use `getTestClient()`
2. **Leaving test data behind** - Always clean up in `afterAll`
3. **Hardcoding client IDs** - Always retrieve dynamically with `getTestClient()`
4. **Testing in production** - Tests run against the same database as development; be careful

## Questions?

If you need to test functionality that requires multiple clients or specific client configurations, consider:

1. Using the existing TEST CLIENT and modifying its data temporarily
2. Mocking the database layer for unit tests
3. Creating a separate test database (requires infrastructure changes)
