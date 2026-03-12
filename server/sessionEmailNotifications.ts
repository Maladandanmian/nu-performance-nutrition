/**
 * Session Email Notifications
 * 
 * Handles sending email notifications for training sessions and group classes:
 * - Booking confirmations when sessions are created
 * - Cancellation notifications when sessions are deleted
 * - 24-hour reminders before upcoming sessions
 */

import { sendEmail } from './emailService';
import { ENV } from './_core/env';

interface SessionDetails {
  id: number;
  clientName: string;
  clientEmail: string;
  sessionType: string;
  customSessionName?: string; // For custom sessions
  customPrice?: string; // For custom sessions
  sessionDate: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  trainerName: string;
  notes?: string;
}

interface GroupClassDetails {
  id: number;
  clientName: string;
  clientEmail: string;
  classType: string;
  classDate: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  trainerName: string;
}

/**
 * Format date and time for email display
 * The date and time are already in Hong Kong time from trainer input
 * We format them directly without timezone conversion to avoid double-conversion errors
 */
function formatDateTime(date: string, time: string): string {
  // date format: "2026-02-20"
  // time format: "14:30"
  const [year, month, day] = date.split('-');
  const [hours, minutes] = time.split(':');
  
  // Parse the components as numbers
  const yearNum = parseInt(year);
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  const hoursNum = parseInt(hours);
  const minutesNum = parseInt(minutes);
  
  // Create date object and format without timezone conversion
  const dateObj = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum);
  
  // Format as "Monday, 20 February 2026 at 2:00 PM"
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  // Use UTC formatting to preserve the exact time without timezone adjustment
  return dateObj.toLocaleString('en-GB', options);
}

/**
 * Send booking confirmation email for a training session
 */
export async function sendSessionBookingConfirmation(session: SessionDetails): Promise<boolean> {
  const subject = 'Training Session Booked - Nu Performance Nutrition';
  const dateTime = formatDateTime(session.sessionDate, session.startTime);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #578DB3; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">Training Session Confirmed</h2>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hi ${session.clientName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Your training session has been booked. Here are the details:
              </p>
              
              <!-- Session Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 4px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; width: 120px;">Session Type:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.sessionType === 'custom' ? 'Custom' : session.sessionType}</td>
                      </tr>
                      ${session.sessionType === 'custom' && session.customSessionName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Session:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.customSessionName}</td>
                      </tr>
                      ` : ''}
                      ${session.customPrice !== undefined ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Price:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">£${parseFloat(session.customPrice || '0').toFixed(2)}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Date & Time:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${dateTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Duration:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.startTime} - ${session.endTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Trainer:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.trainerName}</td>
                      </tr>
                      ${session.notes ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; vertical-align: top;">Notes:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px;">${session.notes}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                You'll receive a reminder 24 hours before your session.
              </p>
              
              <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                If you need to reschedule or cancel, please contact your trainer directly.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Nu Performance Nutrition. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Training Session Confirmed

Hi ${session.clientName},

Your training session has been booked:

Session Type: ${session.sessionType}
Date & Time: ${dateTime}
Duration: ${session.startTime} - ${session.endTime}
Trainer: ${session.trainerName}
${session.notes ? `Notes: ${session.notes}` : ''}

You'll receive a reminder 24 hours before your session.

If you need to reschedule or cancel, please contact your trainer directly.

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: session.clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send cancellation notification email for a training session
 */
export async function sendSessionCancellationNotification(session: SessionDetails): Promise<boolean> {
  const subject = 'Training Session Cancelled - Nu Performance Nutrition';
  const dateTime = formatDateTime(session.sessionDate, session.startTime);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #DC2626; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">Training Session Cancelled</h2>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hi ${session.clientName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Your training session has been cancelled:
              </p>
              
              <!-- Session Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF2F2; border-left: 4px solid #DC2626; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; width: 120px;">Session Type:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.sessionType === 'custom' ? 'Custom' : session.sessionType}</td>
                      </tr>
                      ${session.sessionType === 'custom' && session.customSessionName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Session:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.customSessionName}</td>
                      </tr>
                      ` : ''}
                      ${session.customPrice !== undefined ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Price:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">£${parseFloat(session.customPrice || '0').toFixed(2)}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Date & Time:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${dateTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Trainer:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.trainerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Please contact your trainer if you have any questions or would like to reschedule.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Nu Performance Nutrition. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Training Session Cancelled

Hi ${session.clientName},

Your training session has been cancelled:

Session Type: ${session.sessionType}
Date & Time: ${dateTime}
Trainer: ${session.trainerName}

Please contact your trainer if you have any questions or would like to reschedule.

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: session.clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send 24-hour reminder email for an upcoming training session
 */
export async function sendSessionReminder(session: SessionDetails): Promise<boolean> {
  const subject = 'Reminder: Training Session Tomorrow - Nu Performance Nutrition';
  const dateTime = formatDateTime(session.sessionDate, session.startTime);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #F59E0B; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">🔔 Session Reminder</h2>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hi ${session.clientName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                This is a reminder that you have a training session coming up tomorrow:
              </p>
              
              <!-- Session Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; width: 120px;">Session Type:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.sessionType === 'custom' ? 'Custom' : session.sessionType}</td>
                      </tr>
                      ${session.sessionType === 'custom' && session.customSessionName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Session:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.customSessionName}</td>
                      </tr>
                      ` : ''}
                      ${session.customPrice !== undefined ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Price:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">£${parseFloat(session.customPrice || '0').toFixed(2)}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Date & Time:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${dateTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Duration:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.startTime} - ${session.endTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Trainer:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.trainerName}</td>
                      </tr>
                      ${session.notes ? `
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; vertical-align: top;">Notes:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px;">${session.notes}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.5;">
                See you tomorrow!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Nu Performance Nutrition. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
🔔 Session Reminder

Hi ${session.clientName},

This is a reminder that you have a training session coming up tomorrow:

Session Type: ${session.sessionType}
Date & Time: ${dateTime}
Duration: ${session.startTime} - ${session.endTime}
Trainer: ${session.trainerName}
${session.notes ? `Notes: ${session.notes}` : ''}

See you tomorrow!

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: session.clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send booking confirmation email for a group class
 */
export async function sendGroupClassBookingConfirmation(classDetails: GroupClassDetails): Promise<boolean> {
  const subject = 'Group Class Booked - Nu Performance Nutrition';
  const dateTime = formatDateTime(classDetails.classDate, classDetails.startTime);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #578DB3; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">Group Class Confirmed</h2>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hi ${classDetails.clientName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                You've been registered for a group class:
              </p>
              
              <!-- Class Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 4px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; width: 120px;">Class Type:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${classDetails.classType}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Date & Time:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${dateTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Duration:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${classDetails.startTime} - ${classDetails.endTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Trainer:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${classDetails.trainerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                You'll receive a reminder 24 hours before the class.
              </p>
              
              <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                If you need to cancel, please contact your trainer directly.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Nu Performance Nutrition. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Group Class Confirmed

Hi ${classDetails.clientName},

You've been registered for a group class:

Class Type: ${classDetails.classType}
Date & Time: ${dateTime}
Duration: ${classDetails.startTime} - ${classDetails.endTime}
Trainer: ${classDetails.trainerName}

You'll receive a reminder 24 hours before the class.

If you need to cancel, please contact your trainer directly.

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: classDetails.clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send 24-hour reminder email for an upcoming group class
 */
export async function sendGroupClassReminder(classDetails: GroupClassDetails): Promise<boolean> {
  const subject = 'Reminder: Group Class Tomorrow - Nu Performance Nutrition';
  const dateTime = formatDateTime(classDetails.classDate, classDetails.startTime);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #F59E0B; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">🔔 Class Reminder</h2>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hi ${classDetails.clientName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                This is a reminder that you have a group class coming up tomorrow:
              </p>
              
              <!-- Class Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; width: 120px;">Class Type:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${classDetails.classType}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Date & Time:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${dateTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Duration:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${classDetails.startTime} - ${classDetails.endTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Trainer:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${classDetails.trainerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.5;">
                See you tomorrow!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Nu Performance Nutrition. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
🔔 Class Reminder

Hi ${classDetails.clientName},

This is a reminder that you have a group class coming up tomorrow:

Class Type: ${classDetails.classType}
Date & Time: ${dateTime}
Duration: ${classDetails.startTime} - ${classDetails.endTime}
Trainer: ${classDetails.trainerName}

See you tomorrow!

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: classDetails.clientEmail,
    subject,
    html,
    text,
  });
}


interface SessionChangeDetails {
  oldDate?: string;
  newDate?: string;
  oldStartTime?: string;
  newStartTime?: string;
  oldEndTime?: string;
  newEndTime?: string;
  oldSessionType?: string;
  newSessionType?: string;
}

/**
 * Send notification email when a session is updated
 */
export async function sendSessionUpdateNotification(
  session: SessionDetails,
  changes: SessionChangeDetails
): Promise<boolean> {
  const subject = 'Training Session Updated - Nu Performance Nutrition';
  const dateTime = formatDateTime(session.sessionDate, session.startTime);
  
  // Build list of changes
  let changesList = '';
  if (changes.oldDate && changes.newDate && changes.oldDate !== changes.newDate) {
    const oldDateTime = formatDateTime(changes.oldDate, changes.oldStartTime || session.startTime);
    const newDateTime = formatDateTime(changes.newDate, changes.newStartTime || session.startTime);
    changesList += `<li><strong>Date & Time:</strong> ${oldDateTime} → ${newDateTime}</li>`;
  } else if (changes.oldStartTime && changes.newStartTime && 
             (changes.oldStartTime !== changes.newStartTime || changes.oldEndTime !== changes.newEndTime)) {
    changesList += `<li><strong>Time:</strong> ${changes.oldStartTime} - ${changes.oldEndTime} → ${changes.newStartTime} - ${changes.newEndTime}</li>`;
  }
  
  if (changes.oldSessionType && changes.newSessionType && changes.oldSessionType !== changes.newSessionType) {
    changesList += `<li><strong>Session Type:</strong> ${changes.oldSessionType} → ${changes.newSessionType}</li>`;
  }
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #578DB3; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">Training Session Updated</h2>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hi ${session.clientName},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Your training session has been updated. Here's what changed:
              </p>
              
              <!-- Changes List -->
              <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #666666; font-size: 16px; line-height: 1.8;">
                ${changesList}
              </ul>
              
              <!-- Current Session Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 4px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px 0; color: #333333; font-size: 16px; font-weight: bold;">Current Session Details:</p>
                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 15px;"><strong>Session Type:</strong> ${session.sessionType}</p>
                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 15px;"><strong>Date & Time:</strong> ${dateTime}</p>
                    <p style="margin: 0 0 8px 0; color: #666666; font-size: 15px;"><strong>Duration:</strong> ${session.startTime} - ${session.endTime}</p>
                    <p style="margin: 0; color: #666666; font-size: 15px;"><strong>Trainer:</strong> ${session.trainerName}</p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                If you have any questions or concerns about these changes, please contact your trainer directly.
              </p>
              
              <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.5;">
                See you at your session!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #999999; font-size: 14px;">
                © ${new Date().getFullYear()} Nu Performance Nutrition
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Nu Performance Nutrition

Training Session Updated

Hi ${session.clientName},

Your training session has been updated. Here's what changed:

${changesList.replace(/<[^>]*>/g, '').replace(/&rarr;/g, '→')}

Current Session Details:
- Session Type: ${session.sessionType}
- Date & Time: ${dateTime}
- Duration: ${session.startTime} - ${session.endTime}
- Trainer: ${session.trainerName}

If you have any questions or concerns about these changes, please contact your trainer directly.

See you at your session!

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: session.clientEmail,
    subject,
    html,
    text,
  });
}
