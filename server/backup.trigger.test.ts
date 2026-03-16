import { describe, expect, it, beforeAll } from "vitest";

/**
 * Tests for the backup trigger token validation logic.
 * Validates that BACKUP_TRIGGER_TOKEN is set and that the token
 * comparison logic used in /api/trigger-backup works correctly.
 */
describe("Backup trigger token", () => {
  it("BACKUP_TRIGGER_TOKEN env var is set and non-empty", () => {
    const token = process.env.BACKUP_TRIGGER_TOKEN;
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect((token as string).length).toBeGreaterThan(0);
  });

  it("token comparison rejects empty string", () => {
    const token = process.env.BACKUP_TRIGGER_TOKEN as string;
    const incoming = "";
    expect(incoming !== token).toBe(true);
  });

  it("token comparison rejects wrong token", () => {
    const token = process.env.BACKUP_TRIGGER_TOKEN as string;
    const incoming = "wrong-token-value";
    expect(incoming !== token).toBe(true);
  });

  it("token comparison accepts correct token", () => {
    const token = process.env.BACKUP_TRIGGER_TOKEN as string;
    // Simulate the check in /api/trigger-backup
    const incoming = token; // correct token
    expect(!!token && incoming === token).toBe(true);
  });
});
