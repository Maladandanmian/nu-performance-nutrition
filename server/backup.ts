import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { sendEmail } from "./emailService";
import { ENV } from "./_core/env";
import * as path from "path";

const execAsync = promisify(exec);

/**
 * Parse MySQL connection string to extract connection parameters
 */
function parseMySQLUrl(url: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  // Format: mysql://user:password@host:port/database?params
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    throw new Error('Invalid MySQL connection string format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/**
 * Creates a complete database backup and emails it to the specified recipient
 */
export async function createAndEmailBackup(recipientEmail: string) {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `nu-performance-backup-${timestamp}.sql`;
  const tempFilePath = path.join('/tmp', filename);
  
  try {
    console.log(`[Backup] Starting database backup at ${new Date().toISOString()}`);
    
    // Parse database connection string
    const dbConfig = parseMySQLUrl(ENV.databaseUrl);
    
    // Create mysqldump command
    // Note: --single-transaction is omitted as TiDB Cloud does not support SAVEPOINT
    const dumpCommand = `mysqldump \\
      --host=${dbConfig.host} \\
      --port=${dbConfig.port} \\
      --user=${dbConfig.user} \\
      --password='${dbConfig.password}' \\
      --routines \\
      --triggers \\
      --events \\
      --add-drop-table \\
      --result-file=${tempFilePath} \\
      ${dbConfig.database}`;
    
    console.log(`[Backup] Executing mysqldump for database: ${dbConfig.database}`);
    
    // Execute mysqldump
    await execAsync(dumpCommand);
    
    // Read the SQL file
    const sqlDump = await readFile(tempFilePath);
    const fileSizeKB = (sqlDump.length / 1024).toFixed(2);
    
    console.log(`[Backup] SQL dump created, size: ${fileSizeKB} KB`);
    
    // Send email with SQL file as attachment
    const emailSent = await sendEmail({
      to: recipientEmail,
      subject: `Nu Performance Database Backup - ${timestamp}`,
      text: `Daily database backup for Nu Performance Nutrition.\n\nBackup Details:\n- Date: ${new Date().toLocaleDateString()}\n- Database: ${dbConfig.database}\n- File size: ${fileSizeKB} KB\n\nThe SQL backup file is attached to this email.`,
      html: `
        <h2>Daily Database Backup</h2>
        <p>Your daily database backup for Nu Performance Nutrition is ready.</p>
        <h3>Backup Details:</h3>
        <ul>
          <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
          <li><strong>Database:</strong> ${dbConfig.database}</li>
          <li><strong>File size:</strong> ${fileSizeKB} KB</li>
        </ul>
        <p>The SQL backup file is attached to this email.</p>
        <p><em>This is an automated backup email sent daily at 11:59 PM HKT.</em></p>
      `,
      attachments: [
        {
          filename,
          content: sqlDump,
        }
      ]
    });
    
    // Clean up temp file
    await unlink(tempFilePath);
    
    if (emailSent) {
      console.log(`[Backup] Email sent successfully to ${recipientEmail}`);
      return { success: true, message: `Backup emailed to ${recipientEmail}` };
    } else {
      console.error(`[Backup] Failed to send email to ${recipientEmail}`);
      return { success: false, message: 'Failed to send backup email' };
    }
    
  } catch (error) {
    console.error('[Backup] Error creating backup:', error);
    
    // Try to clean up temp file if it exists
    try {
      await unlink(tempFilePath);
    } catch {}
    
    return { success: false, message: `Backup failed: ${error}` };
  }
}
