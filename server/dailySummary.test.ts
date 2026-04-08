import { describe, it, expect } from 'vitest';
import type { ReminderRecord } from './dailySummaryService';

/**
 * Unit tests for the daily summary service logic.
 *
 * Tests cover:
 *   1. Backup status classification (success / failed / not found)
 *   2. Reminder cross-reference logic (sent vs missed)
 *   3. Email subject line selection
 *   4. Edge cases: empty session lists, boundary timestamps
 */

// ── Backup status helpers (mirrors dailySummaryService.ts logic) ──────────────

const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function classifyBackup(
  lastLog: { status: string; createdAt: Date; errorMessage?: string | null } | null | undefined,
): { succeeded: boolean | null; errorMessage: string | null } {
  if (!lastLog) return { succeeded: null, errorMessage: null };

  const tenHoursAgo = new Date(Date.now() - TEN_HOURS_MS);
  if (lastLog.createdAt < tenHoursAgo) {
    return { succeeded: null, errorMessage: null };
  }

  if (lastLog.status === 'success') {
    return { succeeded: true, errorMessage: null };
  }

  return {
    succeeded: false,
    errorMessage: lastLog.errorMessage ?? 'Backup failed with no error details recorded.',
  };
}

// ── Reminder classification helper (mirrors dailySummaryService.ts logic) ─────

function classifyReminder(
  session: { lastReminderSentAt: Date | null },
): 'sent' | 'missed' {
  const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS);
  if (session.lastReminderSentAt && session.lastReminderSentAt >= twoHoursAgo) {
    return 'sent';
  }
  return 'missed';
}

// ── Email subject helper (mirrors dailySummaryService.ts logic) ───────────────

function buildSubject(
  backupSucceeded: boolean | null,
  missedCount: number,
): string {
  if (missedCount > 0) {
    return `⚠ Daily Summary — ${missedCount} missed reminder(s)`;
  }
  if (backupSucceeded === false || backupSucceeded === null) {
    return '⚠ Daily Summary — backup issue';
  }
  return 'Daily Summary — all clear';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Daily summary — backup status classification', () => {
  it('returns succeeded=true when last backup succeeded within 10 hours', () => {
    const log = { status: 'success', createdAt: new Date(Date.now() - 30 * 60 * 1000), errorMessage: null };
    expect(classifyBackup(log)).toEqual({ succeeded: true, errorMessage: null });
  });

  it('returns succeeded=false when last backup failed within 10 hours', () => {
    const log = { status: 'failed', createdAt: new Date(Date.now() - 60 * 60 * 1000), errorMessage: 'SMTP timeout' };
    expect(classifyBackup(log)).toEqual({ succeeded: false, errorMessage: 'SMTP timeout' });
  });

  it('uses fallback error message when errorMessage is null on a failed backup', () => {
    const log = { status: 'failed', createdAt: new Date(Date.now() - 60 * 60 * 1000), errorMessage: null };
    const result = classifyBackup(log);
    expect(result.succeeded).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('returns succeeded=null when no backup log exists', () => {
    expect(classifyBackup(null)).toEqual({ succeeded: null, errorMessage: null });
    expect(classifyBackup(undefined)).toEqual({ succeeded: null, errorMessage: null });
  });

  it('returns succeeded=null when last backup is older than 10 hours (no overnight run)', () => {
    const log = { status: 'success', createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000), errorMessage: null };
    expect(classifyBackup(log)).toEqual({ succeeded: null, errorMessage: null });
  });

  it('returns succeeded=true when backup ran exactly 9 hours ago (inside window)', () => {
    const log = { status: 'success', createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000), errorMessage: null };
    expect(classifyBackup(log)).toEqual({ succeeded: true, errorMessage: null });
  });
});

describe('Daily summary — reminder classification', () => {
  it('classifies as sent when lastReminderSentAt is within the last 2 hours', () => {
    const session = { lastReminderSentAt: new Date(Date.now() - 20 * 60 * 1000) }; // 20 min ago
    expect(classifyReminder(session)).toBe('sent');
  });

  it('classifies as sent when lastReminderSentAt is 1 minute ago', () => {
    const session = { lastReminderSentAt: new Date(Date.now() - 60 * 1000) };
    expect(classifyReminder(session)).toBe('sent');
  });

  it('classifies as missed when lastReminderSentAt is null', () => {
    const session = { lastReminderSentAt: null };
    expect(classifyReminder(session)).toBe('missed');
  });

  it('classifies as missed when lastReminderSentAt is more than 2 hours ago', () => {
    const session = { lastReminderSentAt: new Date(Date.now() - 3 * 60 * 60 * 1000) };
    expect(classifyReminder(session)).toBe('missed');
  });

  it('classifies as missed when lastReminderSentAt is from yesterday', () => {
    const session = { lastReminderSentAt: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    expect(classifyReminder(session)).toBe('missed');
  });

  it('classifies as sent just inside the 2-hour boundary', () => {
    const session = { lastReminderSentAt: new Date(Date.now() - (TWO_HOURS_MS - 60 * 1000)) };
    expect(classifyReminder(session)).toBe('sent');
  });

  it('classifies as missed just outside the 2-hour boundary', () => {
    const session = { lastReminderSentAt: new Date(Date.now() - (TWO_HOURS_MS + 60 * 1000)) };
    expect(classifyReminder(session)).toBe('missed');
  });
});

describe('Daily summary — email subject line', () => {
  it('uses "all clear" subject when backup succeeded and no missed reminders', () => {
    expect(buildSubject(true, 0)).toBe('Daily Summary — all clear');
  });

  it('flags missed reminders in subject (takes priority over backup status)', () => {
    expect(buildSubject(true, 2)).toBe('⚠ Daily Summary — 2 missed reminder(s)');
    expect(buildSubject(false, 1)).toBe('⚠ Daily Summary — 1 missed reminder(s)');
    expect(buildSubject(null, 3)).toBe('⚠ Daily Summary — 3 missed reminder(s)');
  });

  it('flags backup failure when no missed reminders', () => {
    expect(buildSubject(false, 0)).toBe('⚠ Daily Summary — backup issue');
  });

  it('flags missing backup record when no missed reminders', () => {
    expect(buildSubject(null, 0)).toBe('⚠ Daily Summary — backup issue');
  });

  it('correctly counts a single missed reminder', () => {
    expect(buildSubject(true, 1)).toBe('⚠ Daily Summary — 1 missed reminder(s)');
  });
});

describe('Daily summary — edge cases', () => {
  it('handles empty reminder lists without errors', () => {
    const sent: ReminderRecord[] = [];
    const missed: ReminderRecord[] = [];
    expect(sent.length).toBe(0);
    expect(missed.length).toBe(0);
    expect(buildSubject(true, missed.length)).toBe('Daily Summary — all clear');
  });

  it('correctly separates sent and missed from a mixed list', () => {
    const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS);
    const sessions = [
      { id: 1, lastReminderSentAt: new Date(Date.now() - 30 * 60 * 1000) },  // sent
      { id: 2, lastReminderSentAt: null },                                     // missed
      { id: 3, lastReminderSentAt: new Date(Date.now() - 60 * 60 * 1000) },  // sent
      { id: 4, lastReminderSentAt: new Date(Date.now() - 5 * 60 * 60 * 1000) }, // missed
    ];

    const sent = sessions.filter(s => classifyReminder(s) === 'sent');
    const missed = sessions.filter(s => classifyReminder(s) === 'missed');

    expect(sent.map(s => s.id)).toEqual([1, 3]);
    expect(missed.map(s => s.id)).toEqual([2, 4]);
  });
});
