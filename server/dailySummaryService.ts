/**
 * Daily Summary Email Service
 *
 * Sends a morning summary to the trainer (lukusdavey@gmail.com) at 9:30 AM HKT.
 * The summary covers three areas:
 *   1. Whether last night's backup succeeded (23:00–01:30 HKT window).
 *   2. Which clients received session reminders at 9:00 AM.
 *   3. Which clients with sessions in the next 24 hours did NOT receive a reminder (failed sends).
 *
 * Triggered externally via POST /api/trigger-daily-summary from cron-job.org.
 */

import * as db from './db';
import { sendEmail } from './emailService';

const TRAINER_EMAIL = 'lukusdavey@gmail.com';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReminderRecord {
  type: 'session' | 'group_class';
  id: number;
  clientName: string;
  clientEmail: string;
  sessionType: string;  // e.g. "1-on-1 Training" or class type
  sessionDate: string;  // YYYY-MM-DD
  startTime: string;
  endTime: string;
}

export interface DailySummaryResult {
  backupSucceeded: boolean | null;  // null = no backup attempt found in window
  backupErrorMessage: string | null;
  remindersSent: ReminderRecord[];
  remindersMissed: ReminderRecord[];
  emailSent: boolean;
}

// ── Backup status check ───────────────────────────────────────────────────────

/**
 * Checks whether a successful backup ran in the overnight window.
 * Window: 23:00 HKT yesterday to 01:30 HKT today (i.e. 15:00–17:30 UTC previous day).
 *
 * Returns:
 *   { succeeded: true }  — a successful backup log exists in the window
 *   { succeeded: false, errorMessage }  — only failed log(s) in the window
 *   { succeeded: null }  — no backup log found in the window at all
 */
async function checkOvernightBackup(): Promise<{
  succeeded: boolean | null;
  errorMessage: string | null;
}> {
  try {
    const lastLog = await db.getLastBackupLog();
    if (!lastLog) {
      return { succeeded: null, errorMessage: null };
    }

    // The backup window in UTC: 15:00 yesterday to 17:30 today
    // (23:00 HKT = 15:00 UTC; 01:30 HKT = 17:30 UTC previous day)
    // We check the last 10 hours to be safe (covers 23:00 to ~09:30 HKT).
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

    if (lastLog.createdAt < tenHoursAgo) {
      // Most recent backup is older than 10 hours — nothing ran overnight
      return { succeeded: null, errorMessage: null };
    }

    if (lastLog.status === 'success') {
      return { succeeded: true, errorMessage: null };
    }

    return {
      succeeded: false,
      errorMessage: lastLog.errorMessage || 'Backup failed with no error details recorded.',
    };
  } catch (error) {
    console.error('[DailySummary] Error checking backup status:', error);
    return { succeeded: null, errorMessage: null };
  }
}

// ── Reminder cross-reference ──────────────────────────────────────────────────

/**
 * Builds two lists for sessions scheduled in the next 24 hours:
 *   - remindersSent: sessions where lastReminderSentAt is within the last 2 hours
 *     (i.e. the 9:00 AM batch just ran)
 *   - remindersMissed: sessions where lastReminderSentAt is null or older than 2 hours
 *     (i.e. the reminder was not sent this morning)
 *
 * "Next 24 hours" is calculated from the current UTC time, which corresponds to
 * sessions on tomorrow's date in HKT.
 */
async function buildReminderLists(): Promise<{
  remindersSent: ReminderRecord[];
  remindersMissed: ReminderRecord[];
}> {
  const remindersSent: ReminderRecord[] = [];
  const remindersMissed: ReminderRecord[] = [];

  // The reminder batch runs at 09:00 HKT (01:00 UTC).
  // The summary runs at 09:30 HKT (01:30 UTC).
  // We consider a reminder "sent this morning" if lastReminderSentAt is within the last 2 hours.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Sessions "tomorrow" from the perspective of the 9:00 AM reminder batch
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const trainers = await db.getAllTrainers();

    for (const trainer of trainers) {
      // ── Training sessions ──────────────────────────────────────────────────
      const sessions = await db.getTrainingSessionsByTrainer(trainer.id, tomorrow, tomorrow);

      for (const session of sessions) {
        if (session.cancelled) continue;

        const client = await db.getClientById(session.clientId);
        if (!client || !client.email) continue;

        const record: ReminderRecord = {
          type: 'session',
          id: session.id,
          clientName: client.name,
          clientEmail: client.email,
          sessionType: session.sessionType,
          sessionDate: new Date(session.sessionDate).toISOString().split('T')[0],
          startTime: session.startTime,
          endTime: session.endTime,
        };

        const lastSent = session.lastReminderSentAt ? new Date(session.lastReminderSentAt) : null;
        if (lastSent && lastSent >= twoHoursAgo) {
          remindersSent.push(record);
        } else {
          remindersMissed.push(record);
        }
      }

      // ── Group classes ──────────────────────────────────────────────────────
      const classes = await db.getGroupClassesByTrainer(trainer.id, tomorrow, tomorrow);

      for (const groupClass of classes) {
        if (groupClass.cancelled) continue;

        const attendees = await db.getGroupClassAttendees(groupClass.id);

        for (const attendee of attendees) {
          const client = await db.getClientById(attendee.clientId);
          if (!client || !client.email) continue;

          const record: ReminderRecord = {
            type: 'group_class',
            id: groupClass.id,
            clientName: client.name,
            clientEmail: client.email,
            sessionType: groupClass.classType,
            sessionDate: new Date(groupClass.classDate).toISOString().split('T')[0],
            startTime: groupClass.startTime,
            endTime: groupClass.endTime,
          };

          // Group class uses a single lastReminderSentAt for the whole class
          const lastSent = groupClass.lastReminderSentAt ? new Date(groupClass.lastReminderSentAt) : null;
          if (lastSent && lastSent >= twoHoursAgo) {
            remindersSent.push(record);
          } else {
            remindersMissed.push(record);
          }
        }
      }
    }
  } catch (error) {
    console.error('[DailySummary] Error building reminder lists:', error);
  }

  return { remindersSent, remindersMissed };
}

// ── Email composition ─────────────────────────────────────────────────────────

function formatTime(time: string): string {
  // Expects "HH:MM" or "HH:MM:SS" — return "HH:MM"
  return time.slice(0, 5);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function buildReminderRow(r: ReminderRecord): string {
  return `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #333;">${r.clientName}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #555;">${r.sessionType}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #555;">${formatTime(r.startTime)} – ${formatTime(r.endTime)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 13px;">${r.clientEmail}</td>
    </tr>`;
}

function buildEmailHtml(
  backupSucceeded: boolean | null,
  backupErrorMessage: string | null,
  remindersSent: ReminderRecord[],
  remindersMissed: ReminderRecord[],
): string {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Backup section ────────────────────────────────────────────────────────
  let backupSection: string;
  if (backupSucceeded === true) {
    backupSection = `
      <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
        <p style="margin: 0; color: #166534; font-weight: bold;">&#10003; Last night's backup completed successfully.</p>
      </div>`;
  } else if (backupSucceeded === false) {
    backupSection = `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; color: #991b1b; font-weight: bold;">&#9888; Last night's backup FAILED — manual backup required.</p>
        ${backupErrorMessage ? `<p style="margin: 0; color: #7f1d1d; font-size: 13px;">Error: ${backupErrorMessage}</p>` : ''}
        <p style="margin: 8px 0 0 0; color: #991b1b; font-size: 13px;">Please log in to the trainer dashboard and run a manual backup as soon as possible.</p>
      </div>`;
  } else {
    backupSection = `
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
        <p style="margin: 0; color: #92400e; font-weight: bold;">&#9888; No backup record found for last night.</p>
        <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">The scheduled backup may not have run. Please check the dashboard and run a manual backup if needed.</p>
      </div>`;
  }

  // ── Reminders sent section ─────────────────────────────────────────────────
  let sentSection: string;
  if (remindersSent.length === 0) {
    sentSection = `<p style="color: #6b7280; font-style: italic;">No session reminders were sent this morning.</p>`;
  } else {
    const rows = remindersSent.map(buildReminderRow).join('');
    sentSection = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Client</th>
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Session Type</th>
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Time</th>
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Email</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── Missed reminders section ───────────────────────────────────────────────
  let missedSection: string;
  if (remindersMissed.length === 0) {
    missedSection = `<p style="color: #6b7280; font-style: italic;">All clients with sessions tomorrow received their reminders.</p>`;
  } else {
    const rows = remindersMissed.map(buildReminderRow).join('');
    missedSection = `
      <div style="background-color: #fef2f2; border-radius: 4px; padding: 4px 0; margin-bottom: 12px;">
        <p style="margin: 12px 16px; color: #991b1b; font-size: 13px;">
          The following clients have sessions tomorrow but did not receive a reminder this morning.
          You can resend reminders individually from the trainer dashboard.
        </p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #fef2f2;">
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #fecaca;">Client</th>
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #fecaca;">Session Type</th>
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #fecaca;">Time</th>
            <th style="padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 2px solid #fecaca;">Email</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Summary — Nu Performance Nutrition</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #F59E0B; padding: 28px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold;">Nu Performance Nutrition</h1>
              <p style="margin: 6px 0 0 0; color: #fef3c7; font-size: 14px;">Daily Summary — ${today}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">

              <!-- Backup status -->
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                Overnight Backup
              </h2>
              ${backupSection}

              <!-- Reminders sent -->
              <h2 style="margin: 24px 0 16px 0; color: #111827; font-size: 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                Session Reminders Sent This Morning
                <span style="font-weight: normal; color: #6b7280; font-size: 14px;">(${remindersSent.length})</span>
              </h2>
              ${sentSection}

              <!-- Missed reminders -->
              <h2 style="margin: 24px 0 16px 0; color: #111827; font-size: 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                Missed Reminders — Action Required
                <span style="font-weight: normal; color: ${remindersMissed.length > 0 ? '#ef4444' : '#6b7280'}; font-size: 14px;">(${remindersMissed.length})</span>
              </h2>
              ${missedSection}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Nu Performance Nutrition &nbsp;·&nbsp; This is an automated daily summary.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildEmailText(
  backupSucceeded: boolean | null,
  backupErrorMessage: string | null,
  remindersSent: ReminderRecord[],
  remindersMissed: ReminderRecord[],
): string {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const lines: string[] = [
    `Nu Performance Nutrition — Daily Summary`,
    `${today}`,
    ``,
    `OVERNIGHT BACKUP`,
    `----------------`,
  ];

  if (backupSucceeded === true) {
    lines.push('✓ Last night\'s backup completed successfully.');
  } else if (backupSucceeded === false) {
    lines.push('⚠ Last night\'s backup FAILED — manual backup required.');
    if (backupErrorMessage) lines.push(`Error: ${backupErrorMessage}`);
    lines.push('Please log in to the trainer dashboard and run a manual backup.');
  } else {
    lines.push('⚠ No backup record found for last night.');
    lines.push('Please check the dashboard and run a manual backup if needed.');
  }

  lines.push('', `SESSION REMINDERS SENT THIS MORNING (${remindersSent.length})`, '-------------------------------------------');
  if (remindersSent.length === 0) {
    lines.push('No session reminders were sent this morning.');
  } else {
    for (const r of remindersSent) {
      lines.push(`• ${r.clientName} — ${r.sessionType} ${formatTime(r.startTime)}–${formatTime(r.endTime)} (${r.clientEmail})`);
    }
  }

  lines.push('', `MISSED REMINDERS — ACTION REQUIRED (${remindersMissed.length})`, '---------------------------------------------');
  if (remindersMissed.length === 0) {
    lines.push('All clients with sessions tomorrow received their reminders.');
  } else {
    for (const r of remindersMissed) {
      lines.push(`• ${r.clientName} — ${r.sessionType} ${formatTime(r.startTime)}–${formatTime(r.endTime)} (${r.clientEmail})`);
    }
    lines.push('', 'You can resend reminders individually from the trainer dashboard.');
  }

  lines.push('', '---', '© Nu Performance Nutrition — automated daily summary');
  return lines.join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generates and sends the daily summary email to the trainer.
 * Designed to be called at 9:30 AM HKT (01:30 UTC) after the 9:00 AM reminder batch.
 */
export async function sendDailySummary(): Promise<DailySummaryResult> {
  console.log('[DailySummary] Building daily summary...');

  const [backupStatus, { remindersSent, remindersMissed }] = await Promise.all([
    checkOvernightBackup(),
    buildReminderLists(),
  ]);

  const { succeeded: backupSucceeded, errorMessage: backupErrorMessage } = backupStatus;

  console.log(`[DailySummary] Backup status: ${backupSucceeded === null ? 'not found' : backupSucceeded ? 'success' : 'failed'}`);
  console.log(`[DailySummary] Reminders sent: ${remindersSent.length}, missed: ${remindersMissed.length}`);

  const subject = remindersMissed.length > 0
    ? `⚠ Daily Summary — ${remindersMissed.length} missed reminder(s)`
    : backupSucceeded === false || backupSucceeded === null
      ? '⚠ Daily Summary — backup issue'
      : 'Daily Summary — all clear';

  const html = buildEmailHtml(backupSucceeded, backupErrorMessage, remindersSent, remindersMissed);
  const text = buildEmailText(backupSucceeded, backupErrorMessage, remindersSent, remindersMissed);

  const emailSent = await sendEmail({
    to: TRAINER_EMAIL,
    subject,
    html,
    text,
  });

  if (emailSent) {
    console.log('[DailySummary] Summary email sent successfully.');
  } else {
    console.error('[DailySummary] Failed to send summary email.');
  }

  return {
    backupSucceeded,
    backupErrorMessage,
    remindersSent,
    remindersMissed,
    emailSent,
  };
}
