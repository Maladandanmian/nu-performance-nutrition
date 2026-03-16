import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as db from "./db";
import { sessionPackages, trainingSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Helper to insert a test training session linked to a package
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

describe("Package Management", () => {
  let testClientId: number;
  let testTrainerId: number;
  let packageIds: number[] = [];
  let sessionIds: number[] = [];

  beforeEach(async () => {
    const openId = `test-trainer-${Date.now()}`;
    await db.upsertUser({
      openId,
      name: "TEST TRAINER PACKAGE",
      email: `trainer-package-${Date.now()}@test.com`,
      loginMethod: "oauth",
      role: "admin",
    });
    const trainer = await db.getUserByOpenId(openId);
    if (!trainer) throw new Error("Failed to create test trainer");
    testTrainerId = trainer.id;

    const client = await db.createClient({
      trainerId: testTrainerId,
      name: "TEST CLIENT PACKAGE",
      email: `client-package-${Date.now()}@test.com`,
      phone: "1234567890",
      notes: "Test client for package management",
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
        } catch (error) {
          console.error(`Failed to delete session ${sessionId}:`, error);
        }
      }
      for (const packageId of packageIds) {
        try {
          await dbInstance.delete(sessionPackages).where(eq(sessionPackages.id, packageId));
        } catch (error) {
          console.error(`Failed to delete package ${packageId}:`, error);
        }
      }
    }
    packageIds = [];
    sessionIds = [];

    if (testClientId) {
      await db.deleteClient(testClientId);
    }
  });

  it("should create a session package with full dynamic balance", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "10 Session Package - $1000",
      sessionsTotal: 10,
      sessionsRemaining: 10, // initial value only; not maintained
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: "Test package",
    });
    packageIds.push(pkg.id);

    expect(pkg.id).toBeDefined();
    expect(pkg.sessionsTotal).toBe(10);
    expect(pkg.packageType).toBe("10 Session Package - $1000");

    // Dynamic balance: no sessions yet, so full balance
    const retrieved = await db.getSessionPackageById(pkg.id);
    expect(retrieved?.sessionsRemaining).toBe(10);
  });

  it("should retrieve packages for a client", async () => {
    const pkg1 = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "5 Session Package",
      sessionsTotal: 5,
      sessionsRemaining: 5,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg1.id);

    const pkg2 = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "10 Session Package",
      sessionsTotal: 10,
      sessionsRemaining: 10,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg2.id);

    const packages = await db.getSessionPackagesByClient(testClientId);
    expect(packages.length).toBeGreaterThanOrEqual(2);
    const retrievedIds = packages.map((p: any) => p.id);
    expect(retrievedIds).toContain(pkg1.id);
    expect(retrievedIds).toContain(pkg2.id);
  });

  it("should reflect reduced balance after a session is linked to the package", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "5 Session Package",
      sessionsTotal: 5,
      sessionsRemaining: 5,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    // Full balance before any sessions
    const before = await db.getSessionPackageById(pkg.id);
    expect(before?.sessionsRemaining).toBe(5);

    // checkoutSessionFromPackage validates balance but does not write the column
    const result = await db.checkoutSessionFromPackage(pkg.id);
    expect(result.success).toBe(true);
    expect(result.sessionsRemaining).toBe(4);

    // Insert a non-cancelled session to simulate the booking
    const dbInstance = await db.getDb();
    const sessionId = await insertTestSession(dbInstance, {
      clientId: testClientId,
      trainerId: testTrainerId,
      packageId: pkg.id,
    });
    sessionIds.push(sessionId);

    // Dynamic balance should now reflect 1 session used
    const after = await db.getSessionPackageById(pkg.id);
    expect(after?.sessionsRemaining).toBe(4);
  });

  it("should restore balance when a session is cancelled", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "5 Session Package",
      sessionsTotal: 5,
      sessionsRemaining: 5,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    const dbInstance = await db.getDb();
    const sessionId = await insertTestSession(dbInstance, {
      clientId: testClientId,
      trainerId: testTrainerId,
      packageId: pkg.id,
    });
    sessionIds.push(sessionId);

    // Balance should be 4 (1 session used)
    const before = await db.getSessionPackageById(pkg.id);
    expect(before?.sessionsRemaining).toBe(4);

    // Cancel the session
    if (!dbInstance) throw new Error("DB not available");
    await dbInstance
      .update(trainingSessions)
      .set({ cancelledAt: new Date(), cancelled: true })
      .where(eq(trainingSessions.id, sessionId));

    // Balance should be restored to 5
    const after = await db.getSessionPackageById(pkg.id);
    expect(after?.sessionsRemaining).toBe(5);
  });

  it("should prevent checkout when package has zero balance (dynamic guard)", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "1 Session Package",
      sessionsTotal: 1,
      sessionsRemaining: 1,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    // Insert one non-cancelled session to exhaust the balance
    const dbInstance = await db.getDb();
    const sessionId = await insertTestSession(dbInstance, {
      clientId: testClientId,
      trainerId: testTrainerId,
      packageId: pkg.id,
    });
    sessionIds.push(sessionId);

    // Attempt checkout should throw error
    await expect(db.checkoutSessionFromPackage(pkg.id)).rejects.toThrow(
      "No sessions remaining in package"
    );
  });

  it("should track multiple sessions correctly via dynamic count", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "10 Session Package",
      sessionsTotal: 10,
      sessionsRemaining: 10,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: null,
    });
    packageIds.push(pkg.id);

    // Insert 3 non-cancelled sessions
    const dbInstance = await db.getDb();
    for (let i = 0; i < 3; i++) {
      const sessionId = await insertTestSession(dbInstance, {
        clientId: testClientId,
        trainerId: testTrainerId,
        packageId: pkg.id,
      });
      sessionIds.push(sessionId);
    }

    const updatedPkg = await db.getSessionPackageById(pkg.id);
    expect(updatedPkg?.sessionsRemaining).toBe(7);
    expect(updatedPkg?.sessionsTotal).toBe(10);
  });

  it("should update package details", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "5 Session Package",
      sessionsTotal: 5,
      sessionsRemaining: 5,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: "Original notes",
    });
    packageIds.push(pkg.id);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const expiryDate = futureDate.toISOString().split("T")[0];

    await db.updateSessionPackage(pkg.id, { expiryDate, notes: "Updated notes" });

    const updatedPkg = await db.getSessionPackageById(pkg.id);
    const retrievedDate =
      updatedPkg?.expiryDate instanceof Date
        ? updatedPkg.expiryDate.toISOString().split("T")[0]
        : updatedPkg?.expiryDate;
    expect(retrievedDate).toBe(expiryDate);
    expect(updatedPkg?.notes).toBe("Updated notes");
  });

  it("should handle package with expiry date", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expiryDate = futureDate.toISOString().split("T")[0];

    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "Monthly Package",
      sessionsTotal: 8,
      sessionsRemaining: 8,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate,
      notes: "Expires in 30 days",
    });
    packageIds.push(pkg.id);

    const pkgDate =
      pkg.expiryDate instanceof Date
        ? pkg.expiryDate.toISOString().split("T")[0]
        : pkg.expiryDate;
    expect(pkgDate).toBe(expiryDate);

    const retrievedPkg = await db.getSessionPackageById(pkg.id);
    const retrievedDate =
      retrievedPkg?.expiryDate instanceof Date
        ? retrievedPkg.expiryDate.toISOString().split("T")[0]
        : retrievedPkg?.expiryDate;
    expect(retrievedDate).toBe(expiryDate);
  });
});
