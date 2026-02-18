import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getTestClient, getTestTrainerId } from "./testUtils";
import * as db from "./db";

describe("Supplement Logging System", () => {
  let testClientId: number;
  let testTrainerId: number;

  beforeAll(async () => {
    const testClient = await getTestClient();
    testClientId = testClient.id;
    testTrainerId = await getTestTrainerId();
  });

  afterAll(async () => {
    // Clean up: delete all supplement templates and logs for test client
    const templates = await db.getSupplementTemplatesByClient(testClientId);
    for (const template of templates) {
      await db.deleteSupplementTemplate(template.id);
    }
  });

  it("should create a supplement template", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.supplements.createTemplate({
      clientId: testClientId,
      name: "Vitamin C Tablet",
      dose: "1 tablet",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    expect(result.name).toBe("Vitamin C Tablet");
    expect(result.dose).toBe("1 tablet");
    expect(result.clientId).toBe(testClientId);
  });

  it("should retrieve supplement templates for a client", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const templates = await caller.supplements.getTemplates({
      clientId: testClientId,
    });

    expect(templates).toBeDefined();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0].name).toBe("Vitamin C Tablet");
  });

  it("should enforce maximum 5 supplement templates per client", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    // Create 4 more templates (we already have 1 from previous test)
    await caller.supplements.createTemplate({
      clientId: testClientId,
      name: "Omega-3 Capsule",
      dose: "2 capsules",
    });
    await caller.supplements.createTemplate({
      clientId: testClientId,
      name: "Multivitamin",
      dose: "1 tablet",
    });
    await caller.supplements.createTemplate({
      clientId: testClientId,
      name: "Magnesium",
      dose: "1 tablet",
    });
    await caller.supplements.createTemplate({
      clientId: testClientId,
      name: "Zinc",
      dose: "1 capsule",
    });

    // Try to create a 6th template - should fail
    await expect(
      caller.supplements.createTemplate({
        clientId: testClientId,
        name: "Vitamin D",
        dose: "1 tablet",
      })
    ).rejects.toThrow("Maximum 5 supplement templates allowed per client");
  });

  it("should log a supplement intake", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const templates = await caller.supplements.getTemplates({
      clientId: testClientId,
    });
    const template = templates[0];

    const loggedAt = new Date();
    const result = await caller.supplements.logSupplement({
      clientId: testClientId,
      supplementTemplateId: template.id,
      name: template.name,
      dose: template.dose,
      loggedAt,
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    expect(result.clientId).toBe(testClientId);
    expect(result.supplementTemplateId).toBe(template.id);
    expect(result.name).toBe(template.name);
    expect(result.dose).toBe(template.dose);
  });

  it("should retrieve supplement logs for a client", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const logs = await caller.supplements.getLogs({
      clientId: testClientId,
    });

    expect(logs).toBeDefined();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].name).toBe("Vitamin C Tablet");
  });

  it("should filter supplement logs by date range", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const logs = await caller.supplements.getLogs({
      clientId: testClientId,
      startDate: startOfToday,
      endDate: endOfToday,
    });

    expect(logs).toBeDefined();
    expect(Array.isArray(logs)).toBe(true);
    // Should have at least the log we created in the previous test
    expect(logs.length).toBeGreaterThan(0);
  });

  it("should delete a supplement template", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const templates = await caller.supplements.getTemplates({
      clientId: testClientId,
    });
    const templateToDelete = templates[templates.length - 1]; // Delete the last one

    const result = await caller.supplements.deleteTemplate({
      id: templateToDelete.id,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Verify it's deleted
    const updatedTemplates = await caller.supplements.getTemplates({
      clientId: testClientId,
    });
    expect(updatedTemplates.length).toBe(templates.length - 1);
  });

  it("should delete a supplement log", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const logs = await caller.supplements.getLogs({
      clientId: testClientId,
    });
    const logToDelete = logs[0];

    const result = await caller.supplements.deleteLog({
      id: logToDelete.id,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Verify it's deleted
    const updatedLogs = await caller.supplements.getLogs({
      clientId: testClientId,
    });
    expect(updatedLogs.length).toBe(logs.length - 1);
  });
});
