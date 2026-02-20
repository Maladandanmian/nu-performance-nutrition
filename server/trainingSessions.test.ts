import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Training Sessions", () => {
  let testTrainerId: number;
  let testClientId: number;
  let testSessionId: number;
  let testPackageId: number;

  beforeAll(async () => {
    // Use existing trainer (admin user)
    const trainer = await db.getUserById(1);
    if (!trainer) throw new Error("Test trainer not found");
    testTrainerId = trainer.id;

    // Use existing test client (ID 990036 as per testing guidelines)
    const client = await db.getClientById(990036);
    if (!client) throw new Error("Test client 990036 not found");
    testClientId = client.id;
  });

  it("should create a training session", async () => {
    const session = await db.createTrainingSession({
      trainerId: testTrainerId,
      clientId: testClientId,
      sessionType: "1on1_pt",
      sessionDate: "2026-03-01",
      startTime: "09:00",
      endTime: "10:00",
      paymentStatus: "unpaid",
      packageId: null,
      notes: "Test session",
      recurringRuleId: null,
      cancelled: false,
      cancelledAt: null,
    } as any);

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.sessionType).toBe("1on1_pt");
    testSessionId = session.id;
  });

  it("should retrieve sessions for a client", async () => {
    const sessions = await db.getTrainingSessionsByClient(testClientId);
    expect(sessions).toBeDefined();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].clientId).toBe(testClientId);
  });

  it("should retrieve sessions for a trainer", async () => {
    const sessions = await db.getTrainingSessionsByTrainer(testTrainerId);
    expect(sessions).toBeDefined();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].trainerId).toBe(testTrainerId);
  });

  it("should retrieve a specific session by ID", async () => {
    const session = await db.getTrainingSessionById(testSessionId);
    expect(session).toBeDefined();
    expect(session!.id).toBe(testSessionId);
    expect(session!.sessionType).toBe("1on1_pt");
  });

  it("should update a training session", async () => {
    const result = await db.updateTrainingSession(testSessionId, {
      notes: "Updated test session",
      paymentStatus: "paid",
    } as any);
    expect(result.success).toBe(true);

    const updated = await db.getTrainingSessionById(testSessionId);
    expect(updated!.notes).toBe("Updated test session");
    expect(updated!.paymentStatus).toBe("paid");
  });

  it("should cancel a training session", async () => {
    const result = await db.cancelTrainingSession(testSessionId);
    expect(result.success).toBe(true);

    const cancelled = await db.getTrainingSessionById(testSessionId);
    expect(cancelled!.cancelled).toBe(true);
    expect(cancelled!.cancelledAt).toBeDefined();
  });

  it("should delete a training session", async () => {
    const result = await db.deleteTrainingSession(testSessionId);
    expect(result.success).toBe(true);

    const deleted = await db.getTrainingSessionById(testSessionId);
    expect(deleted).toBeUndefined();
  });
});

describe("Session Packages", () => {
  let testTrainerId: number;
  let testClientId: number;
  let testPackageId: number;

  beforeAll(async () => {
    // Use existing trainer (admin user)
    const trainer = await db.getUserById(1);
    if (!trainer) throw new Error("Test trainer not found");
    testTrainerId = trainer.id;

    // Use existing test client (ID 990036 as per testing guidelines)
    const client = await db.getClientById(990036);
    if (!client) throw new Error("Test client 990036 not found");
    testClientId = client.id;
  });

  it("should create a session package", async () => {
    const pkg = await db.createSessionPackage({
      trainerId: testTrainerId,
      clientId: testClientId,
      packageType: "10 Session Package",
      sessionsTotal: 10,
      sessionsRemaining: 10,
      purchaseDate: "2026-02-19",
      expiryDate: "2026-08-19",
      notes: "Test package",
    } as any);

    expect(pkg).toBeDefined();
    expect(pkg.id).toBeDefined();
    expect(pkg.packageType).toBe("10 Session Package");
    expect(pkg.sessionsTotal).toBe(10);
    expect(pkg.sessionsRemaining).toBe(10);
    testPackageId = pkg.id;
  });

  it("should retrieve packages for a client", async () => {
    const packages = await db.getSessionPackagesByClient(testClientId);
    expect(packages).toBeDefined();
    expect(packages.length).toBeGreaterThan(0);
    expect(packages[0].clientId).toBe(testClientId);
  });

  it("should retrieve a specific package by ID", async () => {
    const pkg = await db.getSessionPackageById(testPackageId);
    expect(pkg).toBeDefined();
    expect(pkg!.id).toBe(testPackageId);
    expect(pkg!.packageType).toBe("10 Session Package");
  });

  it("should checkout a session from package", async () => {
    const result = await db.checkoutSessionFromPackage(testPackageId);
    expect(result.success).toBe(true);
    expect(result.sessionsRemaining).toBe(9);

    const pkg = await db.getSessionPackageById(testPackageId);
    expect(pkg!.sessionsRemaining).toBe(9);
  });

  it("should update a session package", async () => {
    const result = await db.updateSessionPackage(testPackageId, {
      notes: "Updated test package",
      sessionsRemaining: 8,
    } as any);
    expect(result.success).toBe(true);

    const updated = await db.getSessionPackageById(testPackageId);
    expect(updated!.notes).toBe("Updated test package");
    expect(updated!.sessionsRemaining).toBe(8);
  });

  it("should prevent checkout when no sessions remaining", async () => {
    // Set sessions remaining to 0
    await db.updateSessionPackage(testPackageId, {
      sessionsRemaining: 0,
    } as any);

    // Attempt checkout should throw error
    await expect(
      db.checkoutSessionFromPackage(testPackageId)
    ).rejects.toThrow("No sessions remaining in package");
  });

  // Cleanup: Delete test package after all tests
  it("should clean up test package", async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    
    const { sessionPackages } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    await dbInstance.delete(sessionPackages).where(eq(sessionPackages.id, testPackageId));
    
    const deleted = await db.getSessionPackageById(testPackageId);
    expect(deleted).toBeUndefined();
  });
});
