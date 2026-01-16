import { describe, expect, it, beforeAll } from "vitest";
import { isAdminEmail } from "./_core/env";

describe("Admin Email Whitelist", () => {
  beforeAll(() => {
    // Ensure ADMIN_EMAILS is set in the environment
    if (!process.env.ADMIN_EMAILS) {
      throw new Error("ADMIN_EMAILS environment variable is not set");
    }
  });

  it("should validate that ADMIN_EMAILS is configured", () => {
    expect(process.env.ADMIN_EMAILS).toBeDefined();
    expect(process.env.ADMIN_EMAILS?.length).toBeGreaterThan(0);
  });

  it("should include Luke@nuperformancecoaching.com in admin emails", () => {
    const isLukeAdmin = isAdminEmail("Luke@nuperformancecoaching.com");
    expect(isLukeAdmin).toBe(true);
  });

  it("should be case-insensitive for email matching", () => {
    const isLukeAdmin1 = isAdminEmail("luke@nuperformancecoaching.com");
    const isLukeAdmin2 = isAdminEmail("LUKE@NUPERFORMANCECOACHING.COM");
    expect(isLukeAdmin1).toBe(true);
    expect(isLukeAdmin2).toBe(true);
  });

  it("should reject non-admin emails", () => {
    const isRandomAdmin = isAdminEmail("random@example.com");
    expect(isRandomAdmin).toBe(false);
  });

  it("should handle null and undefined emails", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
