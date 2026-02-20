import { describe, it, expect } from 'vitest';
import { sendSessionReminders } from './sessionReminderService';

describe('Session Reminder Service', () => {

  it('should execute without fatal errors', async () => {
    // Run the reminder service (will check tomorrow's sessions in the database)
    const result = await sendSessionReminders();

    // The service should complete and return valid structure
    expect(result.sessionRemindersSent).toBeGreaterThanOrEqual(0);
    expect(result.groupClassRemindersSent).toBeGreaterThanOrEqual(0);
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should return error statistics', async () => {
    // Run the reminder service (even with no sessions)
    const result = await sendSessionReminders();

    // Verify the result structure
    expect(result).toHaveProperty('sessionRemindersSent');
    expect(result).toHaveProperty('groupClassRemindersSent');
    expect(result).toHaveProperty('errors');
    expect(typeof result.sessionRemindersSent).toBe('number');
    expect(typeof result.groupClassRemindersSent).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
