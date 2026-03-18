import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as db from "./db";
import { sessionPackages, trainingSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Tests for the Last Session Alert feature.
 *
 * The alert fires when a trainer books a session linked to a package
 * and that booking exhausts the package balance (sessionsRemaining drops to 0).
 *
 * The detection logic in routers.ts is:
 *   const pkg = await db.getSessionPackageById(input.packageId);
 *   if (pkg && pkg.sessionsRemaining <= 0) { isLastSession = true; }
 *
 * These tests verify the underlying db.getSessionPackageById behaviour
 * that the router relies on.
 */

async function insertTestSession(
  dbInstance: Awaited<ReturnType<typeof db.getDb>>,
  opts: { clientId: number; trainerId: number; packageId: number; cancelled?: boolean }
) {
  if (!dbInstance) throw new Error("DB not available");
  const [result] = await dbInstance.insert(trainingSessions).values({
    clientId: opts.clientId,
    trainerId: opts.trainerId,
    packageId: opts.packageId,
    sessionDate: new Date(),
    startTime: "09:00",
    endTime: "10:00",
    durationMinutes: 60,
    sessionType: "1on1_pt",
    paymentStatus: "from_package",
    price: 0,
    notes: null,
    cancelled: opts.cancelled ?? false,
    cancelledAt: opts.cancelled ? new Date() : null,
    recurringRuleId: null,
    customSessionName: null,
    customDurationMinutes: null,
    customPrice: null,
  } as any);
  return Number((result as any).insertId);
}

describe("Last Session Alert – package balance detection", () => {
  let testClientId: number;
  let testTrainerId: number;
  let packageIds: number[] = [];
  let sessionIds: number[] = [];

  beforeEach(async () => {
    const openId = `test-trainer-lsa-${Date.now()}`;
    await db.upsertUser({
      openId,
      name: "TEST TRAINER LSA",
      email: `trainer-lsa-${Date.now()}@test.com`,
      loginMethod: "oauth",
      role: "admin",
    });
    const trainer = await db.getUserByOpenId(openId);
    if (!trainer) throw new Error("Failed to create test trainer");
    testTrainerId = trainer.id;

    const client = await db.createClient({
      trainerId: testTrainerId,
      name: "TEST CLIENT LSA",
      email: `client-lsa-${Date.now()}@test.com`,
      phone: "1234567890",
      notes: "Test client for last session alert",
      pin: null,
      passwordHash: null,
      emailVerified: false,
      authMethod: "email",
      passwordSetupToken: null,
      passwordSetupTokenExpires: null,
    });
    testClientId = client.id;
  });

  afterEach(async () => {
    const dbInstance = await db.getDb();
    if (dbInstance) {
      for (const sessionId of sessionIds) {
        try {
          await dbInstance.delete(trainingSessions).where(eq(trainingSessions.id, sessionId));
        } catch {}
      }
      for (const packageId of packageIds) {
        try {
          await dbInstance.delete(sessionPackages).where(eq(sessionPackages.id, packageId));
        } catch {}
      }
    }
    packageIds = [];
    sessionIds = [];
    if (testClientId) await db.deleteClient(testClientId);
  });

  it("should NOT trigger alert when package has more than 1 session remaining", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "1on1_pt",
      sessionsTotal: 5,
      sessionsRemaining: 5,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    const dbInstance = await db.getDb();
    for (let i = 0; i < 3; i++) {
      const sid = await insertTestSession(dbInstance, {
        clientId: testClientId,
        trainerId: testTrainerId,
        packageId: pkg.id,
      });
      sessionIds.push(sid);
    }

    const retrieved = await db.getSessionPackageById(pkg.id);
    expect(retrieved?.sessionsRemaining).toBe(2);
    expect((retrieved?.sessionsRemaining ?? 1) <= 0).toBe(false);
  });

  it("should trigger alert when the last session is booked (sessionsRemaining reaches 0)", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "1on1_pt",
      sessionsTotal: 3,
      sessionsRemaining: 3,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    const dbInstance = await db.getDb();
    for (let i = 0; i < 3; i++) {
      const sid = await insertTestSession(dbInstance, {
        clientId: testClientId,
        trainerId: testTrainerId,
        packageId: pkg.id,
      });
      sessionIds.push(sid);
    }

    const retrieved = await db.getSessionPackageById(pkg.id);
    expect(retrieved?.sessionsRemaining).toBe(0);
    expect((retrieved?.sessionsRemaining ?? 1) <= 0).toBe(true);
  });

  it("should NOT trigger alert when package has exactly 1 session remaining (not yet booked)", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "1on1_pt",
      sessionsTotal: 2,
      sessionsRemaining: 2,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    const dbInstance = await db.getDb();
    const sid = await insertTestSession(dbInstance, {
      clientId: testClientId,
      trainerId: testTrainerId,
      packageId: pkg.id,
    });
    sessionIds.push(sid);

    const retrieved = await db.getSessionPackageById(pkg.id);
    expect(retrieved?.sessionsRemaining).toBe(1);
    expect((retrieved?.sessionsRemaining ?? 1) <= 0).toBe(false);
  });

  it("should NOT trigger alert for a cancelled last session (balance restored)", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "1on1_pt",
      sessionsTotal: 1,
      sessionsRemaining: 1,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    const dbInstance = await db.getDb();
    const sid = await insertTestSession(dbInstance, {
      clientId: testClientId,
      trainerId: testTrainerId,
      packageId: pkg.id,
      cancelled: true,
    });
    sessionIds.push(sid);

    const retrieved = await db.getSessionPackageById(pkg.id);
    expect(retrieved?.sessionsRemaining).toBe(1);
    expect((retrieved?.sessionsRemaining ?? 1) <= 0).toBe(false);
  });

  it("should return correct package metadata for the alert email", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "1on1_pt",
      sessionsTotal: 10,
      sessionsRemaining: 10,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    const retrieved = await db.getSessionPackageById(pkg.id);
    expect(retrieved?.packageType).toBe("1on1_pt");
    expect(retrieved?.sessionsTotal).toBe(10);
    expect(typeof retrieved?.packageType).toBe("string");
    expect(typeof retrieved?.sessionsTotal).toBe("number");
  });
});
