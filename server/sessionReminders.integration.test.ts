import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendSessionReminders } from './sessionReminderService';
import * as db from './db';

/**
 * Unit test for the session reminder service.
 * Mocks database calls to test the reminder logic without hitting the real database.
 */
describe('Session Reminders Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it('should handle empty trainer list', async () => {
    // Mock database to return no trainers
    vi.spyOn(db, 'getAllTrainers').mockResolvedValueOnce([]);

    const result = await sendSessionReminders();

    expect(result.sessionRemindersSent).toBe(0);
    expect(result.groupClassRemindersSent).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('should handle trainer with no sessions', async () => {
    // Mock database to return a trainer but no sessions
    vi.spyOn(db, 'getAllTrainers').mockResolvedValueOnce([
      { id: 1, name: 'Test Trainer', email: 'trainer@example.com' } as any,
    ]);
    vi.spyOn(db, 'getTrainingSessionsByTrainer').mockResolvedValueOnce([]);
    vi.spyOn(db, 'getGroupClassesByTrainer').mockResolvedValueOnce([]);

    const result = await sendSessionReminders();

    expect(result.sessionRemindersSent).toBe(0);
    expect(result.groupClassRemindersSent).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should skip sessions without client email', async () => {
    // Mock database to return a session with a client that has no email
    vi.spyOn(db, 'getAllTrainers').mockResolvedValueOnce([
      { id: 1, name: 'Test Trainer', email: 'trainer@example.com' } as any,
    ]);
    vi.spyOn(db, 'getTrainingSessionsByTrainer').mockResolvedValueOnce([
      {
        id: 1,
        clientId: 1,
        sessionType: '1on1_pt',
        sessionDate: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        cancelled: false,
        notes: 'Test session',
      } as any,
    ]);
    vi.spyOn(db, 'getClientById').mockResolvedValueOnce({
      id: 1,
      name: 'Test Client',
      email: null, // No email
    } as any);
    vi.spyOn(db, 'getGroupClassesByTrainer').mockResolvedValueOnce([]);

    const result = await sendSessionReminders();

    expect(result.sessionRemindersSent).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should skip cancelled sessions', async () => {
    // Mock database to return a cancelled session
    vi.spyOn(db, 'getAllTrainers').mockResolvedValueOnce([
      { id: 1, name: 'Test Trainer', email: 'trainer@example.com' } as any,
    ]);
    vi.spyOn(db, 'getTrainingSessionsByTrainer').mockResolvedValueOnce([
      {
        id: 1,
        clientId: 1,
        sessionType: '1on1_pt',
        sessionDate: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        cancelled: true, // Cancelled
        notes: 'Test session',
      } as any,
    ]);
    vi.spyOn(db, 'getGroupClassesByTrainer').mockResolvedValueOnce([]);

    const result = await sendSessionReminders();

    expect(result.sessionRemindersSent).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should return valid structure', async () => {
    // Mock database to return empty results
    vi.spyOn(db, 'getAllTrainers').mockResolvedValueOnce([]);

    const result = await sendSessionReminders();

    // Verify result structure
    expect(result).toHaveProperty('sessionRemindersSent');
    expect(result).toHaveProperty('groupClassRemindersSent');
    expect(result).toHaveProperty('errors');
    expect(typeof result.sessionRemindersSent).toBe('number');
    expect(typeof result.groupClassRemindersSent).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
