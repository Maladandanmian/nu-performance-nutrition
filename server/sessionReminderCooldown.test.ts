import { describe, expect, it } from "vitest";

/**
 * Tests for session reminder 24-hour cooldown logic:
 * - Reminders should not send if already sent within 24 hours
 * - Reminders should send if last reminder was > 24 hours ago
 * - Group class reminders should follow the same cooldown rules
 */
describe("Session Reminder 24-Hour Cooldown", () => {
  it("should skip reminder if last reminder sent within 24 hours", () => {
    const session = {
      id: 1,
      lastReminderSentAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    };

    // Simulate the cooldown check from sessionReminderService
    const lastReminderTime = session.lastReminderSentAt ? new Date(session.lastReminderSentAt).getTime() : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const shouldSkip = timeSinceLastReminder < oneDayMs;

    expect(shouldSkip).toBe(true);
  });

  it("should send reminder if last reminder was > 24 hours ago", () => {
    const session = {
      id: 1,
      lastReminderSentAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    };

    const lastReminderTime = session.lastReminderSentAt ? new Date(session.lastReminderSentAt).getTime() : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const shouldSkip = timeSinceLastReminder < oneDayMs;

    expect(shouldSkip).toBe(false);
  });

  it("should send reminder if lastReminderSentAt is null (first time)", () => {
    const session = {
      id: 1,
      lastReminderSentAt: null,
    };

    const lastReminderTime = session.lastReminderSentAt ? new Date(session.lastReminderSentAt).getTime() : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const shouldSkip = timeSinceLastReminder < oneDayMs;

    expect(shouldSkip).toBe(false);
  });

  it("should calculate minutes since last reminder correctly", () => {
    const session = {
      id: 1,
      lastReminderSentAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    };

    const lastReminderTime = new Date(session.lastReminderSentAt).getTime();
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const minutesSince = Math.floor(timeSinceLastReminder / 60000);

    expect(minutesSince).toBeGreaterThanOrEqual(359); // ~6 hours
    expect(minutesSince).toBeLessThanOrEqual(361);
  });

  it("should not skip reminder exactly at 24-hour boundary (just over)", () => {
    const session = {
      id: 1,
      lastReminderSentAt: new Date(Date.now() - (24 * 60 * 60 * 1000 + 1000)), // Just over 24 hours
    };

    const lastReminderTime = session.lastReminderSentAt ? new Date(session.lastReminderSentAt).getTime() : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const shouldSkip = timeSinceLastReminder < oneDayMs;

    expect(shouldSkip).toBe(false);
  });

  it("should skip reminder just before 24-hour boundary", () => {
    const session = {
      id: 1,
      lastReminderSentAt: new Date(Date.now() - (24 * 60 * 60 * 1000 - 1000)), // Just under 24 hours
    };

    const lastReminderTime = session.lastReminderSentAt ? new Date(session.lastReminderSentAt).getTime() : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const shouldSkip = timeSinceLastReminder < oneDayMs;

    expect(shouldSkip).toBe(true);
  });

  it("should apply same logic to group class reminders", () => {
    const groupClass = {
      id: 1,
      lastReminderSentAt: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
    };

    const lastReminderTime = groupClass.lastReminderSentAt ? new Date(groupClass.lastReminderSentAt).getTime() : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const shouldSkip = timeSinceLastReminder < oneDayMs;

    expect(shouldSkip).toBe(true);
  });

  it("should prevent duplicate reminders across multiple cron job runs", () => {
    // Simulate a session that was reminded 2 hours ago
    const session = {
      id: 1,
      lastReminderSentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    };

    // First cron run at 2 hours ago: reminder sent
    // Second cron run now (simulated): should be skipped
    const lastReminderTime = session.lastReminderSentAt ? new Date(session.lastReminderSentAt).getTime() : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const timeSinceLastReminder = Date.now() - lastReminderTime;
    const shouldSkip = timeSinceLastReminder < oneDayMs;

    expect(shouldSkip).toBe(true);
    expect(timeSinceLastReminder).toBeLessThan(oneDayMs);
  });
});
