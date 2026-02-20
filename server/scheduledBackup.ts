/**
 * Scheduled Database Backup Task
 * 
 * This script is triggered by the Manus scheduler every Monday at 9:00 AM
 * to create a database backup and email it to the configured recipient.
 */

import { createAndEmailBackup } from './backup';

// Recipient email for weekly backups
const BACKUP_RECIPIENT_EMAIL = 'lukusdavey@gmail.com';

async function runWeeklyBackup() {
  console.log(`[ScheduledBackup] Starting weekly backup task at ${new Date().toISOString()}`);
  
  try {
    const result = await createAndEmailBackup(BACKUP_RECIPIENT_EMAIL);
    
    if (result.success) {
      console.log(`[ScheduledBackup] ✓ Backup completed successfully: ${result.message}`);
    } else {
      console.error(`[ScheduledBackup] ✗ Backup failed: ${result.message}`);
    }
    
    return result;
  } catch (error) {
    console.error('[ScheduledBackup] Unexpected error:', error);
    return { success: false, message: `Unexpected error: ${error}` };
  }
}

// Execute if run directly
if (require.main === module) {
  runWeeklyBackup()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('[ScheduledBackup] Fatal error:', error);
      process.exit(1);
    });
}

export { runWeeklyBackup };
