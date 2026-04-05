/**
 * Tests for backup cooldown logic.
 * Rule: cooldown only applies after a SUCCESSFUL backup.
 * A failed backup must never block the manual backup button.
 */

import { describe, it, expect } from 'vitest';

/**
 * Mirrors the server-side cooldown check in routers.ts sendBackup procedure.
 * Returns true if the backup is blocked (cooldown active), false if allowed.
 */
function isCooldownActive(
  lastLog: { status: string; createdAt: Date } | null,
  now: Date = new Date()
): boolean {
  if (!lastLog || lastLog.status !== 'success') return false;
  const lastBackupTime = lastLog.createdAt.getTime();
  const oneDayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  return lastBackupTime > oneDayAgo;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-04-06T10:00:00Z');

describe('Backup cooldown logic', () => {
  it('allows backup when there are no previous logs', () => {
    expect(isCooldownActive(null, now)).toBe(false);
  });

  it('blocks backup when last successful backup was within 24 hours', () => {
    const lastLog = { status: 'success', createdAt: new Date(now.getTime() - 2 * ONE_HOUR_MS) };
    expect(isCooldownActive(lastLog, now)).toBe(true);
  });

  it('allows backup when last successful backup was over 24 hours ago', () => {
    const lastLog = { status: 'success', createdAt: new Date(now.getTime() - 25 * ONE_HOUR_MS) };
    expect(isCooldownActive(lastLog, now)).toBe(false);
  });

  it('allows backup when last attempt FAILED, even if within 24 hours', () => {
    const lastLog = { status: 'failed', createdAt: new Date(now.getTime() - 1 * ONE_HOUR_MS) };
    expect(isCooldownActive(lastLog, now)).toBe(false);
  });

  it('allows backup when last attempt FAILED, even if very recent (minutes ago)', () => {
    const lastLog = { status: 'failed', createdAt: new Date(now.getTime() - 5 * 60 * 1000) };
    expect(isCooldownActive(lastLog, now)).toBe(false);
  });

  it('blocks at exactly 23h 59m after success (still within 24h window)', () => {
    const lastLog = { status: 'success', createdAt: new Date(now.getTime() - (24 * ONE_HOUR_MS - 60 * 1000)) };
    expect(isCooldownActive(lastLog, now)).toBe(true);
  });

  it('allows at exactly 24h 1m after success (just outside 24h window)', () => {
    const lastLog = { status: 'success', createdAt: new Date(now.getTime() - (24 * ONE_HOUR_MS + 60 * 1000)) };
    expect(isCooldownActive(lastLog, now)).toBe(false);
  });
});
