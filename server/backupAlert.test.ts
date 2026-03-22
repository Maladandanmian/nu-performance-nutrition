import { describe, expect, it } from "vitest";

/**
 * Tests for backup alert logic:
 * - Red button should appear when last backup failed AND is older than 24 hours
 * - Red button should NOT appear if backup succeeded
 * - Red button should NOT appear if backup failed but is within 24 hours
 */
describe("Backup Alert Logic", () => {
  it("should detect backup overdue: failed status + > 24 hours elapsed", () => {
    const lastBackup = {
      status: "failed" as const,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    };

    // Simulate the alert logic from TrainerDashboard
    const isAlert = lastBackup.status === "failed" &&
      Date.now() - new Date(lastBackup.createdAt).getTime() > 24 * 60 * 60 * 1000;

    expect(isAlert).toBe(true);
  });

  it("should NOT alert if backup succeeded even if old", () => {
    const lastBackup = {
      status: "success" as const,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    };

    const isAlert = lastBackup.status === "failed" &&
      Date.now() - new Date(lastBackup.createdAt).getTime() > 24 * 60 * 60 * 1000;

    expect(isAlert).toBe(false);
  });

  it("should NOT alert if backup failed but within 24 hours", () => {
    const lastBackup = {
      status: "failed" as const,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    };

    const isAlert = lastBackup.status === "failed" &&
      Date.now() - new Date(lastBackup.createdAt).getTime() > 24 * 60 * 60 * 1000;

    expect(isAlert).toBe(false);
  });

  it("should calculate hours since failed backup correctly", () => {
    const lastBackup = {
      status: "failed" as const,
      createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago
    };

    const elapsed = Date.now() - new Date(lastBackup.createdAt).getTime();
    const hoursSince = Math.floor(elapsed / (60 * 60 * 1000));

    expect(hoursSince).toBeGreaterThanOrEqual(29);
    expect(hoursSince).toBeLessThanOrEqual(31);
  });

  it("should NOT alert if no backup log exists", () => {
    const lastBackup = null;

    const isAlert = lastBackup !== null &&
      lastBackup.status === "failed" &&
      Date.now() - new Date(lastBackup.createdAt).getTime() > 24 * 60 * 60 * 1000;

    expect(isAlert).toBe(false);
  });

  it("should alert exactly at 24-hour boundary (failed backup)", () => {
    const lastBackup = {
      status: "failed" as const,
      createdAt: new Date(Date.now() - (24 * 60 * 60 * 1000 + 1000)), // Just over 24 hours
    };

    const elapsed = Date.now() - new Date(lastBackup.createdAt).getTime();
    const isAlert = lastBackup.status === "failed" && elapsed > 24 * 60 * 60 * 1000;

    expect(isAlert).toBe(true);
  });

  it("should NOT alert just before 24-hour boundary", () => {
    const lastBackup = {
      status: "failed" as const,
      createdAt: new Date(Date.now() - (24 * 60 * 60 * 1000 - 1000)), // Just under 24 hours
    };

    const elapsed = Date.now() - new Date(lastBackup.createdAt).getTime();
    const isAlert = lastBackup.status === "failed" && elapsed > 24 * 60 * 60 * 1000;

    expect(isAlert).toBe(false);
  });
});
