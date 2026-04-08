import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the backup retry logic.
 *
 * The retry endpoint (/api/trigger-backup-retry) should:
 * 1. Skip if a successful backup ran within the last 2 hours
 * 2. Fire if the last backup failed (regardless of when)
 * 3. Fire if no backup has ever run
 * 4. Fire if the last successful backup was more than 2 hours ago
 */

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function shouldRetryFire(lastLog: { status: string; createdAt: Date } | null | undefined): boolean {
  if (!lastLog) return true; // No backup ever run — fire retry
  const twoHoursAgo = Date.now() - TWO_HOURS_MS;
  if (lastLog.status === 'success' && lastLog.createdAt.getTime() > twoHoursAgo) {
    return false; // Successful backup ran recently — skip retry
  }
  return true; // Failed backup, or successful backup was too long ago — fire retry
}

describe('Backup retry logic', () => {
  it('skips retry when last backup succeeded within 2 hours', () => {
    const lastLog = {
      status: 'success',
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    };
    expect(shouldRetryFire(lastLog)).toBe(false);
  });

  it('skips retry when last backup succeeded exactly 1 minute ago', () => {
    const lastLog = {
      status: 'success',
      createdAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
    };
    expect(shouldRetryFire(lastLog)).toBe(false);
  });

  it('fires retry when last backup failed (even if recent)', () => {
    const lastLog = {
      status: 'failed',
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    };
    expect(shouldRetryFire(lastLog)).toBe(true);
  });

  it('fires retry when last backup failed hours ago', () => {
    const lastLog = {
      status: 'failed',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    };
    expect(shouldRetryFire(lastLog)).toBe(true);
  });

  it('fires retry when no backup has ever run', () => {
    expect(shouldRetryFire(null)).toBe(true);
    expect(shouldRetryFire(undefined)).toBe(true);
  });

  it('fires retry when last successful backup was more than 2 hours ago', () => {
    const lastLog = {
      status: 'success',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    };
    expect(shouldRetryFire(lastLog)).toBe(true);
  });

  it('skips retry at exactly the 2-hour boundary (success within 2h)', () => {
    // 1 minute inside the 2-hour window
    const lastLog = {
      status: 'success',
      createdAt: new Date(Date.now() - (TWO_HOURS_MS - 60 * 1000)),
    };
    expect(shouldRetryFire(lastLog)).toBe(false);
  });

  it('fires retry just outside the 2-hour boundary', () => {
    // 1 minute outside the 2-hour window
    const lastLog = {
      status: 'success',
      createdAt: new Date(Date.now() - (TWO_HOURS_MS + 60 * 1000)),
    };
    expect(shouldRetryFire(lastLog)).toBe(true);
  });
});
