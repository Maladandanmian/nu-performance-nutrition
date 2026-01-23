import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("DEXA Goals", () => {
  let testClientId: number;

  beforeEach(async () => {
    // Create a test client
    const client = await db.createClient({
      trainerId: 1,
      name: "Test DEXA Client",
      email: "dexa-test@example.com",
      phone: "1234567890",
      pin: "999888",
      notes: "Test client for DEXA goals",
    });
    testClientId = client[0].insertId;
  });

  afterEach(async () => {
    // Clean up test data
    await db.deleteClientAndData(testClientId);
  });

  it("should return null when no DEXA goals exist for a client", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" },
    } as any);

    const goals = await caller.dexa.getGoals({ clientId: testClientId });
    expect(goals).toBeNull();
  });

  it("should create DEXA goals for a client", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" },
    } as any);

    await caller.dexa.updateGoals({
      clientId: testClientId,
      vatTarget: 69.9,
      bodyFatPctTarget: 18.5,
      leanMassTarget: 75.0,
      boneDensityTarget: 1.2,
    });

    const goals = await caller.dexa.getGoals({ clientId: testClientId });
    expect(goals).not.toBeNull();
    expect(goals?.vatTarget).toBe("69.9");
    expect(goals?.bodyFatPctTarget).toBe("18.5");
    expect(goals?.leanMassTarget).toBe("75.0");
    expect(goals?.boneDensityTarget).toBe("1.20");
  });

  it("should update existing DEXA goals", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" },
    } as any);

    // Create initial goals
    await caller.dexa.updateGoals({
      clientId: testClientId,
      vatTarget: 69.9,
      bodyFatPctTarget: 18.5,
    });

    // Update goals
    await caller.dexa.updateGoals({
      clientId: testClientId,
      vatTarget: 65.0,
      leanMassTarget: 80.0,
    });

    const goals = await caller.dexa.getGoals({ clientId: testClientId });
    expect(goals?.vatTarget).toBe("65.0");
    expect(goals?.leanMassTarget).toBe("80.0");
    // Body fat target should still be there
    expect(goals?.bodyFatPctTarget).toBe("18.5");
  });

  it("should allow partial updates to DEXA goals", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" },
    } as any);

    // Create goals with only VAT target
    await caller.dexa.updateGoals({
      clientId: testClientId,
      vatTarget: 69.9,
    });

    const goals = await caller.dexa.getGoals({ clientId: testClientId });
    expect(goals?.vatTarget).toBe("69.9");
    expect(goals?.bodyFatPctTarget).toBeNull();
    expect(goals?.leanMassTarget).toBeNull();
    expect(goals?.boneDensityTarget).toBeNull();
  });

  it("should prevent non-admin users from updating DEXA goals", async () => {
    const caller = appRouter.createCaller({
      user: { id: 2, role: "user" },
    } as any);

    await expect(
      caller.dexa.updateGoals({
        clientId: testClientId,
        vatTarget: 69.9,
      })
    ).rejects.toThrow("Only trainers can access this resource");
  });

  it("should allow authenticated users to read DEXA goals", async () => {
    const adminCaller = appRouter.createCaller({
      user: { id: 1, role: "admin" },
    } as any);

    // Create goals as admin
    await adminCaller.dexa.updateGoals({
      clientId: testClientId,
      vatTarget: 69.9,
    });

    // Read as regular user
    const userCaller = appRouter.createCaller({
      user: { id: 2, role: "user" },
    } as any);

    const goals = await userCaller.dexa.getGoals({ clientId: testClientId });
    expect(goals?.vatTarget).toBe("69.9");
  });
});
