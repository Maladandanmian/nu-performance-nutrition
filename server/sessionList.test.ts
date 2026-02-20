import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestClient, getTestTrainerId } from "./testUtils";
import {
  createTrainingSession,
  getTrainingSessionsByTrainer,
  deleteTrainingSession,
} from "./db";

describe("Session List Functionality", () => {
  let testClientId: number;
  let testTrainerId: number;
  let sessionIds: number[] = [];

  beforeAll(async () => {
    const client = await getTestClient();
    testClientId = client.id;
    testTrainerId = await getTestTrainerId();
  });

  afterAll(async () => {
    // Clean up all test sessions
    for (const sessionId of sessionIds) {
      try {
        await deleteTrainingSession(sessionId);
      } catch (error) {
        // Session may already be deleted
      }
    }
  });

  it("should retrieve sessions by trainer", async () => {
    // Create test sessions (use future dates)
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 60);

    const session1 = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "1on1_pt",
      sessionDate,
      startTime: "10:00",
      endTime: "11:00",
      durationMinutes: 60,
      paymentStatus: "paid",
    });
    sessionIds.push(session1.id);

    const session2 = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "nutrition_coaching",
      sessionDate,
      startTime: "14:00",
      endTime: "15:00",
      durationMinutes: 60,
      paymentStatus: "unpaid",
    });
    sessionIds.push(session2.id);

    // Query sessions starting from a day before
    const queryStart = new Date(sessionDate);
    queryStart.setDate(queryStart.getDate() - 1);
    const sessions = await getTrainingSessionsByTrainer(testTrainerId, queryStart);
    
    const sessionIds_retrieved = sessions.map((s: any) => s.id);
    expect(sessionIds_retrieved).toContain(session1.id);
    expect(sessionIds_retrieved).toContain(session2.id);
  });

  it("should include client information in session list", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 20);

    const session = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "nutrition_initial",
      sessionDate,
      startTime: "11:00",
      endTime: "12:00",
      durationMinutes: 60,
      paymentStatus: "paid",
    });
    sessionIds.push(session.id);

    // Query with a start date before the session date
    const queryDate = new Date(sessionDate);
    queryDate.setDate(queryDate.getDate() - 1);
    const sessions = await getTrainingSessionsByTrainer(testTrainerId, queryDate);
    const createdSession = sessions.find((s: any) => s.id === session.id);

    expect(createdSession).toBeDefined();
    expect(createdSession.client).toBeDefined();
    expect(createdSession.client.name).toBe("TEST CLIENT");
  });

  it("should successfully delete a session", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 30);

    const session = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "1on1_pt",
      sessionDate,
      startTime: "15:00",
      endTime: "16:00",
      durationMinutes: 60,
      paymentStatus: "unpaid",
    });

    // Delete the session
    await deleteTrainingSession(session.id);

    // Verify it's deleted
    const sessions = await getTrainingSessionsByTrainer(testTrainerId, sessionDate);
    const deletedSession = sessions.find((s: any) => s.id === session.id);
    expect(deletedSession).toBeUndefined();
  });

  it("should handle sessions with different payment statuses", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 40);

    const paidSession = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "1on1_pt",
      sessionDate,
      startTime: "10:00",
      endTime: "11:00",
      durationMinutes: 60,
      paymentStatus: "paid",
    });
    sessionIds.push(paidSession.id);

    const unpaidSession = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "nutrition_coaching",
      sessionDate,
      startTime: "11:00",
      endTime: "12:00",
      durationMinutes: 60,
      paymentStatus: "unpaid",
    });
    sessionIds.push(unpaidSession.id);

    const packageSession = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "2on1_pt",
      sessionDate,
      startTime: "12:00",
      endTime: "13:00",
      durationMinutes: 60,
      paymentStatus: "from_package",
    });
    sessionIds.push(packageSession.id);

    // Query with a start date before the session date
    const queryDate = new Date(sessionDate);
    queryDate.setDate(queryDate.getDate() - 1);
    const sessions = await getTrainingSessionsByTrainer(testTrainerId, queryDate);
    
    const paid = sessions.find((s: any) => s.id === paidSession.id);
    const unpaid = sessions.find((s: any) => s.id === unpaidSession.id);
    const fromPackage = sessions.find((s: any) => s.id === packageSession.id);

    expect(paid?.paymentStatus).toBe("paid");
    expect(unpaid?.paymentStatus).toBe("unpaid");
    expect(fromPackage?.paymentStatus).toBe("from_package");
  });

  it("should include session notes when provided", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 50);

    const testNotes = "Client requested focus on upper body strength";

    const session = await createTrainingSession({
      clientId: testClientId,
      trainerId: testTrainerId,
      sessionType: "1on1_pt",
      sessionDate,
      startTime: "16:00",
      endTime: "17:00",
      durationMinutes: 60,
      paymentStatus: "paid",
      notes: testNotes,
    });
    sessionIds.push(session.id);

    // Query with a start date before the session date
    const queryDate = new Date(sessionDate);
    queryDate.setDate(queryDate.getDate() - 1);
    const sessions = await getTrainingSessionsByTrainer(testTrainerId, queryDate);
    const createdSession = sessions.find((s: any) => s.id === session.id);

    expect(createdSession?.notes).toBe(testNotes);
  });
});
