import { describe, it, expect, afterAll } from 'vitest';
import { appRouter } from './routers';
import { TEST_CLIENT_ID } from './testSetup';
import * as db from './db';

describe('Strength Tests', () => {
  const testClientId = TEST_CLIENT_ID; // Use existing test client (43 yr old male)
  let testId: number;
  const testIdsToCleanup: number[] = [];
  const testStartTime = Date.now(); // Timestamp when tests started

  afterAll(async () => {
    // Clean up all test data created during this test suite
    // Only delete strength tests that were created during THIS test run
    // We track this by comparing the createdAt timestamp
    const allTests = await db.getAllGripStrengthTests(testClientId);
    for (const test of allTests) {
      // Only delete tests created after this test suite started running
      if (new Date(test.createdAt).getTime() >= testStartTime) {
        await db.deleteStrengthTest(test.id);
      }
    }
  });

  it('should add a grip strength test', async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: 'admin' },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.strengthTests.addGripStrength({
      clientId: testClientId,
      value: 45,
      testedAt: new Date('2026-01-28'),
      notes: 'Test grip strength',
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe('Normal'); // 45kg is in normal range (36-50kg) for male 40-59
  });

  it('should get latest grip strength test', async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: 'admin' },
      req: {} as any,
      res: {} as any,
    });

    const latest = await caller.strengthTests.getLatestGripStrength({
      clientId: testClientId,
    });

    expect(latest).not.toBeNull();
    expect(latest?.value).toBe(45);
    expect(latest?.score).toBe('Normal');
    testId = latest!.id;
  });

  it('should update grip strength test', async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: 'admin' },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.strengthTests.updateGripStrength({
      testId,
      value: 52,
      testedAt: new Date('2026-01-30'),
      notes: 'Updated test',
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe('Strong'); // 52kg > 50kg (max) for male 40-59, so Strong
  });

  it('should reflect updated value in latest test', async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: 'admin' },
      req: {} as any,
      res: {} as any,
    });

    const latest = await caller.strengthTests.getLatestGripStrength({
      clientId: testClientId,
    });

    expect(latest).not.toBeNull();
    expect(latest?.value).toBe(52);
    expect(latest?.score).toBe('Strong');
  });

  it('should correctly score grip strength for 40-59 age group', async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: 'admin' },
      req: {} as any,
      res: {} as any,
    });

    // Test client is 43 years old (40-59 age group, 36-50kg normal range)
    
    // Test normal range
    const result1 = await caller.strengthTests.addGripStrength({
      clientId: testClientId,
      value: 45,
      testedAt: new Date('2026-01-25'),
    });
    expect(result1.score).toBe('Normal'); // 45kg is in range (36-50kg)

    // Test strong (above range)
    const result2 = await caller.strengthTests.addGripStrength({
      clientId: testClientId,
      value: 55,
      testedAt: new Date('2026-01-26'),
    });
    expect(result2.score).toBe('Strong'); // 55kg > 50kg

    // Test weak (below range)
    const result3 = await caller.strengthTests.addGripStrength({
      clientId: testClientId,
      value: 30,
      testedAt: new Date('2026-01-27'),
    });
    expect(result3.score).toBe('Weak'); // 30kg < 36kg
  });
});
