import { getDb, createBackupLog } from "./db";
import * as schema from "../drizzle/schema";
import { gzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

/**
 * Queries every table via Drizzle and returns a JSON backup object.
 * Uses sequential batching (5 tables at a time) to avoid overwhelming the connection pool.
 * This avoids mysqldump entirely, which hangs on TiDB Cloud.
 */
async function dumpAllTables(): Promise<Record<string, unknown[]>> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const queries = [
    { name: 'users', query: () => db.select().from(schema.users) },
    { name: 'clients', query: () => db.select().from(schema.clients) },
    { name: 'nutritionGoals', query: () => db.select().from(schema.nutritionGoals) },
    { name: 'dexaGoals', query: () => db.select().from(schema.dexaGoals) },
    { name: 'meals', query: () => db.select().from(schema.meals) },
    { name: 'drinks', query: () => db.select().from(schema.drinks) },
    { name: 'bodyMetrics', query: () => db.select().from(schema.bodyMetrics) },
    { name: 'dexaScans', query: () => db.select().from(schema.dexaScans) },
    { name: 'dexaBmdData', query: () => db.select().from(schema.dexaBmdData) },
    { name: 'dexaBodyComp', query: () => db.select().from(schema.dexaBodyComp) },
    { name: 'dexaImages', query: () => db.select().from(schema.dexaImages) },
    { name: 'loginAttempts', query: () => db.select().from(schema.loginAttempts) },
    { name: 'rateLimitLocks', query: () => db.select().from(schema.rateLimitLocks) },
    { name: 'passwordResetTokens', query: () => db.select().from(schema.passwordResetTokens) },
    { name: 'auditLogs', query: () => db.select().from(schema.auditLogs) },
    { name: 'emailVerificationTokens', query: () => db.select().from(schema.emailVerificationTokens) },
    { name: 'athleteMonitoring', query: () => db.select().from(schema.athleteMonitoring) },
    { name: 'strengthTests', query: () => db.select().from(schema.strengthTests) },
    { name: 'nutritionReports', query: () => db.select().from(schema.nutritionReports) },
    { name: 'vo2MaxTests', query: () => db.select().from(schema.vo2MaxTests) },
    { name: 'vo2MaxAmbientData', query: () => db.select().from(schema.vo2MaxAmbientData) },
    { name: 'vo2MaxAnthropometric', query: () => db.select().from(schema.vo2MaxAnthropometric) },
    { name: 'vo2MaxFitnessAssessment', query: () => db.select().from(schema.vo2MaxFitnessAssessment) },
    { name: 'vo2MaxLactateProfile', query: () => db.select().from(schema.vo2MaxLactateProfile) },
    { name: 'trainerNotifications', query: () => db.select().from(schema.trainerNotifications) },
    { name: 'notificationSettings', query: () => db.select().from(schema.notificationSettings) },
    { name: 'supplementTemplates', query: () => db.select().from(schema.supplementTemplates) },
    { name: 'supplementLogs', query: () => db.select().from(schema.supplementLogs) },
    { name: 'trainingSessions', query: () => db.select().from(schema.trainingSessions) },
    { name: 'groupClasses', query: () => db.select().from(schema.groupClasses) },
    { name: 'groupClassAttendance', query: () => db.select().from(schema.groupClassAttendance) },
    { name: 'recurringSessionRules', query: () => db.select().from(schema.recurringSessionRules) },
    { name: 'sessionPackages', query: () => db.select().from(schema.sessionPackages) },
    { name: 'backupLogs', query: () => db.select().from(schema.backupLogs) },
  ];

  const data: Record<string, unknown[]> = {};
  const batchSize = 5; // Query 5 tables at a time to avoid overwhelming the connection

  console.log(`[Backup] Starting sequential batch queries (batch size: ${batchSize})`);

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    console.log(`[Backup] Querying batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(queries.length / batchSize)}: ${batch.map(q => q.name).join(', ')}`);

    const results = await Promise.allSettled(batch.map(q => q.query()));

    results.forEach((result, index) => {
      const tableName = batch[index].name;
      if (result.status === 'fulfilled') {
        data[tableName] = result.value;
      } else {
        console.warn(`[Backup] Warning: failed to query ${tableName}: ${result.reason}`);
        data[tableName] = []; // Use empty array as fallback
      }
    });
  }

  return data;
}

/**
 * Creates a complete database backup and emails it to the specified recipient.
 * Uses Drizzle queries instead of mysqldump to ensure compatibility with TiDB Cloud.
 * Compresses the backup with gzip before emailing.
 * @param trainerId - If provided, the result is written to backup_logs for dashboard visibility.
 */
export async function createAndEmailBackup(recipientEmail: string, trainerId?: number) {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `nu-performance-backup-${timestamp}.json.gz`;

  try {
    console.log(`[Backup] Starting database backup at ${new Date().toISOString()}`);

    const data = await dumpAllTables();

    const backupPayload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      tables: data,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const jsonBuffer = Buffer.from(jsonString, 'utf-8');
    
    // Compress the JSON before emailing
    console.log(`[Backup] Compressing backup (uncompressed: ${Math.ceil(jsonBuffer.length / 1024)} KB)`);
    const compressedBuffer = await gzipAsync(jsonBuffer);
    const compressedSizeKB = Math.ceil(compressedBuffer.length / 1024);
    
    console.log(`[Backup] Backup compressed: ${compressedSizeKB} KB (compression ratio: ${(100 - Math.round(compressedSizeKB * 1024 / jsonBuffer.length * 100)).toFixed(1)}%)`);

    // Send email with compressed backup attachment
    const emailResult = await sendBackupEmail(recipientEmail, filename, compressedBuffer);

    if (emailResult.success) {
      console.log(`[Backup] Email sent successfully to ${recipientEmail}`);
      const logTrainerId = trainerId || 1; // Fallback to primary admin if owner lookup fails
      await createBackupLog({
        trainerId: logTrainerId,
        status: 'success',
        backupDate: new Date(),
        fileSizeKB: compressedSizeKB,
        recipientEmail,
      }).catch(e => console.error('[Backup] Failed to write backup log:', e));
      return { success: true, message: `Backup completed and emailed to ${recipientEmail}` };
    } else {
      console.error('[Backup] Failed to send email:', emailResult.error);
      const logTrainerId = trainerId || 1; // Fallback to primary admin if owner lookup fails
      await createBackupLog({
        trainerId: logTrainerId,
        status: 'failed',
        backupDate: new Date(),
        fileSizeKB: compressedSizeKB,
        recipientEmail,
        errorMessage: emailResult.error || 'Failed to send email',
      }).catch(e => console.error('[Backup] Failed to write backup log:', e));
      return { success: false, message: 'Failed to send backup email' };
    }

  } catch (error) {
    console.error('[Backup] Error creating backup:', error);
    const logTrainerId = trainerId || 1; // Fallback to primary admin if owner lookup fails
    const errorMsg = error instanceof Error ? error.message : String(error);
    await createBackupLog({
      trainerId: logTrainerId,
      status: 'failed',
      backupDate: new Date(),
      fileSizeKB: null,
      recipientEmail,
      errorMessage: errorMsg,
    }).catch(e => console.error('[Backup] Failed to write backup log:', e));
    return { success: false, message: `Backup failed: ${errorMsg}` };
  }
}

/**
 * Sends the backup file as an email attachment.
 */
async function sendBackupEmail(
  recipientEmail: string,
  filename: string,
  buffer: Buffer
): Promise<{ success: boolean; error?: string }> {
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: recipientEmail,
      subject: `Nu Performance Nutrition - Database Backup (${new Date().toISOString().split('T')[0]})`,
      text: 'Please find the attached compressed database backup file (.json.gz). Extract with: gunzip backup.json.gz',
      html: '<p>Please find the attached compressed database backup file (.json.gz).</p><p>Extract with: <code>gunzip backup.json.gz</code></p>',
      attachments: [
        {
          filename,
          content: buffer,
          contentType: 'application/gzip',
        },
      ],
    });

    console.log(`[Backup] Email sent: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Backup] Error sending email:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
