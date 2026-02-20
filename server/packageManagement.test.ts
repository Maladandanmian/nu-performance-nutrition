import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as db from "./db";
import { sessionPackages } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Package Management", () => {
  let testClientId: number;
  let testTrainerId: number;
  let packageIds: number[] = [];

  beforeEach(async () => {
    // Create test trainer
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

    // Create test client
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
    // Clean up packages
    for (const packageId of packageIds) {
      try {
        const dbInstance = await db.getDb();
        if (dbInstance) {
          await dbInstance.delete(sessionPackages).where(eq(sessionPackages.id, packageId));
        }
      } catch (error) {
        console.error(`Failed to delete package ${packageId}:`, error);
      }
    }
    packageIds = [];

    // Clean up client
    if (testClientId) {
      await db.deleteClient(testClientId);
    }
    // Note: Users are not deleted in tests to avoid breaking OAuth state
  });

  it("should create a session package", async () => {
    const pkg = await db.createSessionPackage({
      clientId: testClientId,
      trainerId: testTrainerId,
      packageType: "10 Session Package - $1000",
      sessionsTotal: 10,
      sessionsRemaining: 10,
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      notes: "Test package",
    });

    packageIds.push(pkg.id);

    expect(pkg.id).toBeDefined();
    expect(pkg.sessionsTotal).toBe(10);
    expect(pkg.sessionsRemaining).toBe(10);
    expect(pkg.packageType).toBe("10 Session Package - $1000");
  });

  it("should retrieve packages for a client", async () => {
    // Create two packages
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
    const packageIds_retrieved = packages.map((p: any) => p.id);
    expect(packageIds_retrieved).toContain(pkg1.id);
    expect(packageIds_retrieved).toContain(pkg2.id);
  });

  it("should checkout a session from a package", async () => {
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

    // Checkout one session
    const result = await db.checkoutSessionFromPackage(pkg.id);

    expect(result.success).toBe(true);
    expect(result.sessionsRemaining).toBe(4);

    // Verify the package was updated
    const updatedPkg = await db.getSessionPackageById(pkg.id);
    expect(updatedPkg?.sessionsRemaining).toBe(4);
  });

  it("should prevent checkout when package has zero balance", async () => {
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

    // Checkout the only session
    await db.checkoutSessionFromPackage(pkg.id);

    // Try to checkout again (should fail)
    await expect(db.checkoutSessionFromPackage(pkg.id)).rejects.toThrow(
      "No sessions remaining in package"
    );
  });

  it("should track multiple checkouts correctly", async () => {
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

    // Checkout 3 sessions
    await db.checkoutSessionFromPackage(pkg.id);
    await db.checkoutSessionFromPackage(pkg.id);
    await db.checkoutSessionFromPackage(pkg.id);

    // Verify balance
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

    // Update package
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const expiryDate = futureDate.toISOString().split("T")[0];

    await db.updateSessionPackage(pkg.id, {
      expiryDate,
      notes: "Updated notes",
    });

    // Verify updates
    const updatedPkg = await db.getSessionPackageById(pkg.id);
    // Database returns Date object, convert to ISO date string
    const retrievedDate = updatedPkg?.expiryDate instanceof Date 
      ? updatedPkg.expiryDate.toISOString().split('T')[0]
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

    // Database returns Date object, convert to ISO date string
    const pkgDate = pkg.expiryDate instanceof Date 
      ? pkg.expiryDate.toISOString().split('T')[0]
      : pkg.expiryDate;
    expect(pkgDate).toBe(expiryDate);

    // Verify retrieval
    const retrievedPkg = await db.getSessionPackageById(pkg.id);
    const retrievedDate = retrievedPkg?.expiryDate instanceof Date 
      ? retrievedPkg.expiryDate.toISOString().split('T')[0]
      : retrievedPkg?.expiryDate;
    expect(retrievedDate).toBe(expiryDate);
  });
});
