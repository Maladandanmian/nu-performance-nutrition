import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendEmail } from "./emailService";
import * as envModule from "./_core/env";

describe("Email Whitelist System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect emails to whitelist when EMAIL_WHITELIST_ENABLED is true", async () => {
    // Mock ENV to enable whitelist
    const originalEnv = { ...envModule.ENV };
    Object.defineProperty(envModule, "ENV", {
      value: {
        ...originalEnv,
        emailWhitelistEnabled: true,
        emailWhitelist: ["andy@andyknight.asia", "lukusdavey@gmail.com"],
        emailHost: "smtp.gmail.com",
        emailPort: "587",
        emailUser: "lukusdavey@gmail.com",
        emailPassword: "kpharwwoxdbecnzn",
        emailFrom: "lukusdavey@gmail.com",
      },
      writable: true,
    });

    // Spy on console.log to verify whitelist mode message
    const consoleSpy = vi.spyOn(console, "log");

    // Attempt to send email to a client (should be redirected)
    const result = await sendEmail({
      to: "client@example.com",
      subject: "Test Email",
      html: "<p>Test</p>",
      text: "Test",
    });

    // Verify whitelist mode was activated
    expect(
      consoleSpy.mock.calls.some((call) =>
        call[0]?.includes("WHITELIST MODE")
      )
    ).toBe(true);

    // Restore original ENV
    Object.defineProperty(envModule, "ENV", {
      value: originalEnv,
      writable: true,
    });

    consoleSpy.mockRestore();
  });

  it("should not redirect emails when EMAIL_WHITELIST_ENABLED is false", async () => {
    // Mock ENV to disable whitelist
    const originalEnv = { ...envModule.ENV };
    Object.defineProperty(envModule, "ENV", {
      value: {
        ...originalEnv,
        emailWhitelistEnabled: false,
        emailWhitelist: ["andy@andyknight.asia", "lukusdavey@gmail.com"],
        emailHost: "smtp.gmail.com",
        emailPort: "587",
        emailUser: "lukusdavey@gmail.com",
        emailPassword: "kpharwwoxdbecnzn",
        emailFrom: "lukusdavey@gmail.com",
      },
      writable: true,
    });

    // Spy on console.log to verify no whitelist mode message
    const consoleSpy = vi.spyOn(console, "log");

    // Attempt to send email
    const result = await sendEmail({
      to: "client@example.com",
      subject: "Test Email",
      html: "<p>Test</p>",
      text: "Test",
    });

    // Verify whitelist mode was NOT activated
    expect(
      consoleSpy.mock.calls.some((call) =>
        call[0]?.includes("WHITELIST MODE")
      )
    ).toBe(false);

    // Restore original ENV
    Object.defineProperty(envModule, "ENV", {
      value: originalEnv,
      writable: true,
    });

    consoleSpy.mockRestore();
  });

  it("should have correct default whitelist emails", () => {
    // Verify default whitelist contains both emails
    expect(envModule.ENV.emailWhitelist).toContain("andy@andyknight.asia");
    expect(envModule.ENV.emailWhitelist).toContain("lukusdavey@gmail.com");
  });

  it("should have whitelist enabled by default", () => {
    // Verify whitelist is enabled in current environment
    expect(envModule.ENV.emailWhitelistEnabled).toBe(true);
  });
});
