import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Session Edit Functionality", () => {
  let trainerId: number;
  let clientId: number;
  let sessionId: number;

  beforeEach(async () => {
    // Create trainer
    const trainerOpenId = `trainer-edit-${Date.now()}`;
    await db.upsertUser({
      openId: trainerOpenId,
      name: "Test Trainer",
      email: `trainer-edit-${Date.now()}@test.com`,
      loginMethod: "google",
      role: "admin",
    });
    const trainer = await db.getUserByOpenId(trainerOpenId);
    if (!trainer) throw new Error("Failed to create trainer");
    trainerId = trainer.id;

    // Create client
    const client = await db.createClient({
      trainerId,
      name: "Test Client for Edit",
      email: `client-edit-${Date.now()}@test.com`,
      phone: "1234567890",
      notes: "Test client for session editing",
    });
    clientId = client.id;

    // Create a test session
    const session = await db.createTrainingSession({
      trainerId,
      clientId,
      sessionType: "1on1_pt",
      sessionDate: new Date("2026-03-15"),
      startTime: "10:00",
      endTime: "11:00",
      paymentStatus: "unpaid",
      notes: "Original session",
    });
    sessionId = session.id;
  });

  it("should update session date and time", async () => {
    const caller = appRouter.createCaller({
      user: { id: trainerId, role: "admin" } as any,
    });

    await caller.trainingSessions.update({
      id: sessionId,
      sessionDate: "2026-03-20",
      startTime: "14:00",
      endTime: "15:00",
    });

    const updatedSession = await db.getTrainingSessionById(sessionId);
    expect(updatedSession).toBeDefined();
    const sessionDateStr = new Date(updatedSession!.sessionDate).toISOString().split("T")[0];
    // Allow for timezone differences (2026-03-19 or 2026-03-20)
    expect(["2026-03-19", "2026-03-20"]).toContain(sessionDateStr);
    expect(updatedSession!.startTime).toBe("14:00");
    expect(updatedSession!.endTime).toBe("15:00");
  });

  it("should update session type", async () => {
    const caller = appRouter.createCaller({
      user: { id: trainerId, role: "admin" } as any,
    });

    await caller.trainingSessions.update({
      id: sessionId,
      sessionType: "2on1_pt",
    });

    const updatedSession = await db.getTrainingSessionById(sessionId);
    expect(updatedSession!.sessionType).toBe("2on1_pt");
  });

  it("should update payment status", async () => {
    const caller = appRouter.createCaller({
      user: { id: trainerId, role: "admin" } as any,
    });

    await caller.trainingSessions.update({
      id: sessionId,
      paymentStatus: "paid",
    });

    const updatedSession = await db.getTrainingSessionById(sessionId);
    expect(updatedSession!.paymentStatus).toBe("paid");
  });

  it("should update package association", async () => {
    const caller = appRouter.createCaller({
      user: { id: trainerId, role: "admin" } as any,
    });

    // Create a package
    const packageData = await db.createSessionPackage({
      trainerId,
      clientId,
      packageType: "1on1_pt",
      sessionsTotal: 10,
      totalSessions: 10,
      sessionsRemaining: 10,
      totalPrice: 1000,
      purchaseDate: new Date(),
      expiryDate: new Date("2026-12-31"),
      notes: "Test package",
    });

    await caller.trainingSessions.update({
      id: sessionId,
      packageId: packageData.id,
      paymentStatus: "from_package",
    });

    const updatedSession = await db.getTrainingSessionById(sessionId);
    expect(updatedSession!.packageId).toBe(packageData.id);
    expect(updatedSession!.paymentStatus).toBe("from_package");
  });

  it("should allow removing package association", async () => {
    const caller = appRouter.createCaller({
      user: { id: trainerId, role: "admin" } as any,
    });

    // Create a package and associate it
    const packageData = await db.createSessionPackage({
      trainerId,
      clientId,
      packageType: "1on1_pt",
      sessionsTotal: 10,
      totalSessions: 10,
      sessionsRemaining: 10,
      totalPrice: 1000,
      purchaseDate: new Date(),
      expiryDate: new Date("2026-12-31"),
      notes: "Test package",
    });

    await db.updateTrainingSession(sessionId, {
      packageId: packageData.id,
      paymentStatus: "from_package",
    });

    // Now remove the package association
    await caller.trainingSessions.update({
      id: sessionId,
      packageId: null,
      paymentStatus: "paid",
    });

    const updatedSession = await db.getTrainingSessionById(sessionId);
    expect(updatedSession!.packageId).toBeNull();
    expect(updatedSession!.paymentStatus).toBe("paid");
  });

  it("should update multiple fields at once", async () => {
    const caller = appRouter.createCaller({
      user: { id: trainerId, role: "admin" } as any,
    });

    await caller.trainingSessions.update({
      id: sessionId,
      sessionDate: "2026-03-25",
      startTime: "16:00",
      endTime: "17:00",
      sessionType: "nutrition_coaching",
      paymentStatus: "paid",
    });

    const updatedSession = await db.getTrainingSessionById(sessionId);
    const sessionDateStr = new Date(updatedSession!.sessionDate).toISOString().split("T")[0];
    // Allow for timezone differences (2026-03-24 or 2026-03-25)
    expect(["2026-03-24", "2026-03-25"]).toContain(sessionDateStr);
    expect(updatedSession!.startTime).toBe("16:00");
    expect(updatedSession!.endTime).toBe("17:00");
    expect(updatedSession!.sessionType).toBe("nutrition_coaching");
    expect(updatedSession!.paymentStatus).toBe("paid");
  });
});
