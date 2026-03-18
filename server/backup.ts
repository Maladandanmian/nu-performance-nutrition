import { sendEmail } from "./emailService";
import { getDb, createBackupLog } from "./db";
import * as schema from "../drizzle/schema";

/**
 * Queries every table via Drizzle and returns a JSON backup object.
 * This avoids mysqldump entirely, which hangs on TiDB Cloud.
 */
async function dumpAllTables(): Promise<Record<string, unknown[]>> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [
    users,
    clients,
    nutritionGoals,
    dexaGoals,
    meals,
    drinks,
    bodyMetrics,
    dexaScans,
    dexaBmdData,
    dexaBodyComp,
    dexaImages,
    loginAttempts,
    rateLimitLocks,
    passwordResetTokens,
    auditLogs,
    emailVerificationTokens,
    athleteMonitoring,
    strengthTests,
    nutritionReports,
    vo2MaxTests,
    vo2MaxAmbientData,
    vo2MaxAnthropometric,
    vo2MaxFitnessAssessment,
    vo2MaxLactateProfile,
    trainerNotifications,
    notificationSettings,
    supplementTemplates,
    supplementLogs,
    trainingSessions,
    groupClasses,
    groupClassAttendance,
    recurringSessionRules,
    sessionPackages,
    backupLogs,
  ] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.clients),
    db.select().from(schema.nutritionGoals),
    db.select().from(schema.dexaGoals),
    db.select().from(schema.meals),
    db.select().from(schema.drinks),
    db.select().from(schema.bodyMetrics),
    db.select().from(schema.dexaScans),
    db.select().from(schema.dexaBmdData),
    db.select().from(schema.dexaBodyComp),
    db.select().from(schema.dexaImages),
    db.select().from(schema.loginAttempts),
    db.select().from(schema.rateLimitLocks),
    db.select().from(schema.passwordResetTokens),
    db.select().from(schema.auditLogs),
    db.select().from(schema.emailVerificationTokens),
    db.select().from(schema.athleteMonitoring),
    db.select().from(schema.strengthTests),
    db.select().from(schema.nutritionReports),
    db.select().from(schema.vo2MaxTests),
    db.select().from(schema.vo2MaxAmbientData),
    db.select().from(schema.vo2MaxAnthropometric),
    db.select().from(schema.vo2MaxFitnessAssessment),
    db.select().from(schema.vo2MaxLactateProfile),
    db.select().from(schema.trainerNotifications),
    db.select().from(schema.notificationSettings),
    db.select().from(schema.supplementTemplates),
    db.select().from(schema.supplementLogs),
    db.select().from(schema.trainingSessions),
    db.select().from(schema.groupClasses),
    db.select().from(schema.groupClassAttendance),
    db.select().from(schema.recurringSessionRules),
    db.select().from(schema.sessionPackages),
    db.select().from(schema.backupLogs),
  ]);

  return {
    users,
    clients,
    nutritionGoals,
    dexaGoals,
    meals,
    drinks,
    bodyMetrics,
    dexaScans,
    dexaBmdData,
    dexaBodyComp,
    dexaImages,
    loginAttempts,
    rateLimitLocks,
    passwordResetTokens,
    auditLogs,
    emailVerificationTokens,
    athleteMonitoring,
    strengthTests,
    nutritionReports,
    vo2MaxTests,
    vo2MaxAmbientData,
    vo2MaxAnthropometric,
    vo2MaxFitnessAssessment,
    vo2MaxLactateProfile,
    trainerNotifications,
    notificationSettings,
    supplementTemplates,
    supplementLogs,
    trainingSessions,
    groupClasses,
    groupClassAttendance,
    recurringSessionRules,
    sessionPackages,
    backupLogs,
  };
}

/**
 * Creates a complete database backup and emails it to the specified recipient.
 * Uses Drizzle queries instead of mysqldump to ensure compatibility with TiDB Cloud.
 * @param trainerId - If provided, the result is written to backup_logs for dashboard visibility.
 */
export async function createAndEmailBackup(recipientEmail: string, trainerId?: number) {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `nu-performance-backup-${timestamp}.json`;

  try {
    console.log(`[Backup] Starting database backup at ${new Date().toISOString()}`);

    const data = await dumpAllTables();

    const backupPayload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      tables: data,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const fileBuffer = Buffer.from(jsonString, 'utf8');
    const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);

    // Build a summary of row counts for the email body
    const rowCounts = Object.entries(data)
      .map(([table, rows]) => `<li><strong>${table}:</strong> ${(rows as unknown[]).length} rows</li>`)
      .join('\n');

    console.log(`[Backup] JSON dump created, size: ${fileSizeKB} KB`);

    const emailSent = await sendEmail({
      to: recipientEmail,
      subject: `Nu Performance Daily Database Backup - ${timestamp}`,
      text: `Daily database backup for Nu Performance Nutrition.\n\nBackup Details:\n- Date: ${timestamp}\n- File size: ${fileSizeKB} KB\n\nThe JSON backup file is attached to this email.`,
      html: `
        <h2>Daily Database Backup</h2>
        <p>Your daily database backup for Nu Performance Nutrition is attached.</p>
        <h3>Backup Details:</h3>
        <ul>
          <li><strong>Date:</strong> ${timestamp}</li>
          <li><strong>File size:</strong> ${fileSizeKB} KB</li>
        </ul>
        <h3>Row Counts:</h3>
        <ul>
          ${rowCounts}
        </ul>
        <p><em>This is an automated backup email sent daily at 11:59 PM HKT.</em></p>
      `,
      attachments: [
        {
          filename,
          content: fileBuffer,
        },
      ],
    });

    const logTrainerId = trainerId || 1; // Fallback to primary admin if owner lookup fails

    if (emailSent) {
      console.log(`[Backup] Email sent successfully to ${recipientEmail}`);
      await createBackupLog({
        trainerId: logTrainerId,
        status: 'success',
        backupDate: new Date(),
        fileSizeKB: Math.round(parseFloat(fileSizeKB)),
        recipientEmail,
        errorMessage: null,
      }).catch(e => console.error('[Backup] Failed to write backup log:', e));
      return { success: true, message: `Backup emailed to ${recipientEmail}`, fileSizeKB };
    } else {
      console.error(`[Backup] Failed to send email to ${recipientEmail}`);
      await createBackupLog({
        trainerId: logTrainerId,
        status: 'failed',
        backupDate: new Date(),
        fileSizeKB: null,
        recipientEmail,
        errorMessage: 'Failed to send backup email',
      }).catch(e => console.error('[Backup] Failed to write backup log:', e));
      return { success: false, message: 'Failed to send backup email' };
    }

  } catch (error) {
    console.error('[Backup] Error creating backup:', error);
    const logTrainerId = trainerId || 1; // Fallback to primary admin if owner lookup fails
    await createBackupLog({
      trainerId: logTrainerId,
      status: 'failed',
      backupDate: new Date(),
      fileSizeKB: null,
      recipientEmail,
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(e => console.error('[Backup] Failed to write backup log:', e));
    return { success: false, message: `Backup failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
