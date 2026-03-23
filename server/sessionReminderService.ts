import * as db from './db';
import { sendSessionReminder, sendGroupClassReminder } from './sessionEmailNotifications';

/**
 * Send 24-hour reminder emails for upcoming training sessions
 * This function should be called daily by a scheduled task
 */
export async function sendSessionReminders(): Promise<{
  sessionRemindersSent: number;
  groupClassRemindersSent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sessionRemindersSent = 0;
  let groupClassRemindersSent = 0;

  try {
    // Calculate the date 24 hours from now
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

    console.log(`[SessionReminders] Checking for sessions on ${tomorrowDateStr}`);

    // Get all trainers to check their sessions
    const trainers = await db.getAllTrainers();
    
    for (const trainer of trainers) {
      try {
        // Get training sessions for tomorrow
        const sessions = await db.getTrainingSessionsByTrainer(
          trainer.id,
          tomorrow,
          tomorrow
        );

        // Send reminders for each session
        for (const session of sessions) {
          try {
            // Skip cancelled sessions
            if (session.cancelled) {
              continue;
            }

            // Get client details
            const client = await db.getClientById(session.clientId);
            if (!client || !client.email) {
              console.warn(`[SessionReminders] No email for client ${session.clientId}`);
              continue;
            }

            // Check if reminder was already sent within the last 24 hours
            const lastReminderTime = session.lastReminderSentAt ? new Date(session.lastReminderSentAt).getTime() : 0;
            const oneDayMs = 24 * 60 * 60 * 1000;
            const timeSinceLastReminder = Date.now() - lastReminderTime;

            if (timeSinceLastReminder < oneDayMs) {
              console.log(`[SessionReminders] Skipping session ${session.id} - reminder already sent ${Math.floor(timeSinceLastReminder / 60000)} minutes ago`);
              continue;
            }

            // Send reminder email
            await sendSessionReminder({
              id: session.id,
              clientName: client.name,
              clientEmail: client.email,
              sessionType: session.sessionType,
              sessionDate: new Date(session.sessionDate).toISOString().split('T')[0],
              startTime: session.startTime,
              endTime: session.endTime,
              trainerName: trainer.name || 'Your Trainer',
              notes: session.notes || undefined,
            });

            // Update lastReminderSentAt timestamp
            await db.updateSessionReminderTimestamp(session.id);

            sessionRemindersSent++;
            console.log(`[SessionReminders] Sent reminder for session ${session.id} to ${client.email}`);
          } catch (error) {
            const errorMsg = `Failed to send reminder for session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[SessionReminders] ${errorMsg}`);
            errors.push(errorMsg);
          }
        }

        // Get group classes for tomorrow
        const groupClasses = await db.getGroupClassesByTrainer(
          trainer.id,
          tomorrow,
          tomorrow
        );

        // Send reminders for each group class
        for (const groupClass of groupClasses) {
          try {
            // Skip cancelled classes
            if (groupClass.cancelled) {
              continue;
            }

            // Check if reminder was already sent within the last 24 hours
            const lastReminderTime = groupClass.lastReminderSentAt ? new Date(groupClass.lastReminderSentAt).getTime() : 0;
            const oneDayMs = 24 * 60 * 60 * 1000;
            const timeSinceLastReminder = Date.now() - lastReminderTime;

            if (timeSinceLastReminder < oneDayMs) {
              console.log(`[SessionReminders] Skipping group class ${groupClass.id} - reminder already sent ${Math.floor(timeSinceLastReminder / 60000)} minutes ago`);
              continue;
            }

            // Get attendees
            const attendees = await db.getGroupClassAttendees(groupClass.id);

            // Send reminders for each group class (only once per 24 hours)
            let reminderSentToAnyAttendee = false;
            for (const attendee of attendees) {
              try {
                const client = await db.getClientById(attendee.clientId);
                if (!client || !client.email) {
                  console.warn(`[SessionReminders] No email for client ${attendee.clientId}`);
                  continue;
                }

                // Send reminder email
                await sendGroupClassReminder({
                  id: groupClass.id,
                  clientName: client.name,
                  clientEmail: client.email,
                  classType: groupClass.classType,
                  classDate: new Date(groupClass.classDate).toISOString().split('T')[0],
                  startTime: groupClass.startTime,
                  endTime: groupClass.endTime,
                  trainerName: trainer.name || 'Your Trainer',
                });

                reminderSentToAnyAttendee = true;
                groupClassRemindersSent++;
                console.log(`[SessionReminders] Sent reminder for group class ${groupClass.id} to ${client.email}`);
              } catch (error) {
                const errorMsg = `Failed to send reminder for group class ${groupClass.id} to client ${attendee.clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(`[SessionReminders] ${errorMsg}`);
                errors.push(errorMsg);
              }
            }

            // Update lastReminderSentAt timestamp if any reminder was sent
            if (reminderSentToAnyAttendee) {
              await db.updateGroupClassReminderTimestamp(groupClass.id);
            }
          } catch (error) {
            const errorMsg = `Failed to process group class ${groupClass.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`[SessionReminders] ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to process trainer ${trainer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[SessionReminders] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[SessionReminders] Completed: ${sessionRemindersSent} session reminders, ${groupClassRemindersSent} group class reminders sent`);
    
    return {
      sessionRemindersSent,
      groupClassRemindersSent,
      errors,
    };
  } catch (error) {
    const errorMsg = `Fatal error in sendSessionReminders: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[SessionReminders] ${errorMsg}`);
    errors.push(errorMsg);
    
    return {
      sessionRemindersSent,
      groupClassRemindersSent,
      errors,
    };
  }
}


