import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Client Session Queries", () => {
  let testClientId: number;
  let testSession1Id: number;
  let testSession2Id: number;
  let testGroupClassId: number;

  beforeAll(async () => {
    // Create a test client with unique identifiers
    const timestamp = Date.now();
    const client = await db.createClient({
      trainerId: 1,
      name: "Test Client Schedule",
      email: `schedule${timestamp}@test.com`,
      phone: "1234567890",
      pin: `${timestamp}`.slice(-6),
      notes: "Test client for schedule",
    });
    testClientId = client.id;

    // Create test training sessions
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const session1 = await db.createTrainingSession({
      clientId: testClientId,
      trainerId: 1,
      sessionType: "1on1_pt",
      sessionDate: tomorrow.toISOString().split('T')[0],
      startTime: "10:00",
      endTime: "11:00",
      paymentStatus: "paid",
      packageId: null,
      notes: "Morning session",
    });
    testSession1Id = session1.id;

    const session2 = await db.createTrainingSession({
      clientId: testClientId,
      trainerId: 1,
      sessionType: "nutrition_coaching",
      sessionDate: nextWeek.toISOString().split('T')[0],
      startTime: "14:00",
      endTime: "15:00",
      paymentStatus: "unpaid",
      packageId: null,
      notes: "Nutrition check-in",
    });
    testSession2Id = session2.id;

    // Create a test group class
    const groupClass = await db.createGroupClass({
      trainerId: 1,
      classType: "hyrox",
      classDate: tomorrow.toISOString().split('T')[0],
      startTime: "18:00",
      endTime: "19:00",
      capacity: 10,
      notes: "Evening Hyrox class",
    });
    testGroupClassId = groupClass.id;

    // Enroll client in group class
    await db.addClientToGroupClass({
      groupClassId: testGroupClassId,
      clientId: testClientId,
      paymentStatus: "paid",
      packageId: null,
      attended: false,
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testSession1Id) await db.deleteTrainingSession(testSession1Id);
    if (testSession2Id) await db.deleteTrainingSession(testSession2Id);
    if (testGroupClassId) await db.deleteGroupClass(testGroupClassId);
    if (testClientId) await db.deleteClient(testClientId);
  });

  it("should retrieve upcoming training sessions for a client", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
    const sessions = await caller.trainingSessions.getUpcoming({
      clientId: testClientId,
      days: 30,
    });

    expect(sessions).toBeDefined();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.some(s => s.id === testSession1Id)).toBe(true);
    expect(sessions.some(s => s.id === testSession2Id)).toBe(true);
  });

  it("should retrieve upcoming group classes for a client", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
    const classes = await caller.groupClasses.getClientClasses({
      clientId: testClientId,
      days: 30,
    });

    expect(classes).toBeDefined();
    expect(classes.length).toBeGreaterThanOrEqual(1);
    expect(classes.some(c => c.id === testGroupClassId)).toBe(true);
  });

  it("should only return sessions within the specified date range", async () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
    const sessions = await caller.trainingSessions.getUpcoming({
      clientId: testClientId,
      days: 3, // Only next 3 days
    });

    expect(sessions).toBeDefined();
    // Should include tomorrow's session but not next week's
    expect(sessions.some(s => s.id === testSession1Id)).toBe(true);
    expect(sessions.some(s => s.id === testSession2Id)).toBe(false);
  });

  it("should return empty array for client with no sessions", async () => {
    // Create a client with no sessions
    const timestamp2 = Date.now();
    const emptyClient = await db.createClient({
      trainerId: 1,
      name: "Empty Client",
      email: `empty${timestamp2}@test.com`,
      phone: "0000000000",
      pin: `${timestamp2}`.slice(-6),
      notes: "No sessions",
    });

    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
    const sessions = await caller.trainingSessions.getUpcoming({
      clientId: emptyClient.id,
      days: 30,
    });

    expect(sessions).toBeDefined();
    expect(sessions.length).toBe(0);

    // Cleanup
    await db.deleteClient(emptyClient.id);
  });

  it("should return empty array for client not enrolled in any group classes", async () => {
    // Create a client with no group classes
    const timestamp3 = Date.now();
    const emptyClient = await db.createClient({
      trainerId: 1,
      name: "No Classes Client",
      email: `noclasses${timestamp3}@test.com`,
      phone: "0000000001",
      pin: `${timestamp3}`.slice(-6),
      notes: "No classes",
    });

    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });
    const classes = await caller.groupClasses.getClientClasses({
      clientId: emptyClient.id,
      days: 30,
    });

    expect(classes).toBeDefined();
    expect(classes.length).toBe(0);

    // Cleanup
    await db.deleteClient(emptyClient.id);
  });
});
