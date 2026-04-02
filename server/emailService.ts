/**
 * Email Service
 * 
 * Handles sending emails for password setup invitations and other notifications.
 * Uses Nodemailer with SMTP for reliable email delivery (same as backup system).
 * 
 * Configuration:
 * - Requires EMAIL_HOST env var (SMTP server hostname)
 * - Requires EMAIL_PORT env var (SMTP port, typically 587 or 465)
 * - Requires EMAIL_USER env var (SMTP username)
 * - Requires EMAIL_PASSWORD env var (SMTP password)
 * - Requires EMAIL_FROM env var (sender email address)
 */

import { ENV } from './_core/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

/**
 * Send an email using Nodemailer with SMTP
 * Returns true if email was sent successfully, false otherwise
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Check if email whitelist is enabled (development/testing mode)
  let recipientEmail = options.to;
  if (ENV.emailWhitelistEnabled) {
    const originalTo = options.to;
    recipientEmail = ENV.emailWhitelist[0]; // Send to first whitelisted email
    console.log(`[EmailService] WHITELIST MODE: Redirecting email from ${originalTo} to ${recipientEmail}`);
  }

  // Check if email is configured
  const emailHost = ENV.emailHost;
  const emailPort = ENV.emailPort;
  const emailUser = ENV.emailUser;
  const emailPassword = ENV.emailPassword;
  const emailFrom = ENV.emailFrom || 'Nu Performance Nutrition <noreply@nunutrition.com>';
  
  // Debug logging
  console.log(`[EmailService] Checking config - host: ${emailHost}, port: ${emailPort}, user: ${emailUser}, from: ${emailFrom}`);

  // If email is not configured, log to console and return false
  if (!emailHost || !emailPort || !emailUser || !emailPassword) {
    console.log('[EmailService] Email not configured. Would have sent:');
    console.log(`[EmailService] To: ${options.to}`);
    console.log(`[EmailService] Subject: ${options.subject}`);
    console.log(`[EmailService] Body (text): ${options.text || 'N/A'}`);
    return false;
  }

  try {
    // Import nodemailer dynamically
    const nodemailer = await import('nodemailer');
    
    // Create SMTP transporter
    const transporter = nodemailer.default.createTransport({
      host: emailHost,
      port: parseInt(emailPort),
      secure: emailPort === '465', // Use TLS for port 465, STARTTLS for others
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: emailFrom,
      to: recipientEmail,
      subject: options.subject,
      text: options.text,
      html: options.html,
      ...(options.attachments && options.attachments.length > 0 ? {
        attachments: options.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: 'application/octet-stream',
        })),
      } : {}),
    });

    console.log(`[EmailService] Email sent successfully to ${recipientEmail} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[EmailService] Failed to send email to ${recipientEmail}: ${errorMsg}`);
    return false;
  }
}

/**
 * Parse email address string into Nodemailer format
 * Handles both "Name <email@example.com>" and "email@example.com" formats
 */
function parseEmailAddress(emailString: string): string {
  return emailString;
}

/**
 * Send password setup invitation email
 */
export async function sendPasswordSetupInvitation(
  clientEmail: string,
  clientName: string,
  setupLink: string
): Promise<boolean> {
  const subject = 'Welcome to Nu Performance Nutrition - Set Your Password';
  
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
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">Welcome, ${clientName}!</h2>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Your account has been created. Please click the button below to set your password and activate your account.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${setupLink}" style="display: inline-block; background-color: #F59E0B; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                Or copy and paste this link in your browser:
              </p>
              <p style="margin: 0 0 30px 0; color: #0066cc; font-size: 12px; word-break: break-all;">
                ${setupLink}
              </p>
              
              <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">
                This link will expire in 24 hours for security reasons.
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
Welcome to Nu Performance Nutrition!

Your account has been created. Please click the link below to set your password and activate your account:

${setupLink}

This link will expire in 24 hours for security reasons.

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send email verification link
 */
export async function sendEmailVerification(
  clientEmail: string,
  clientName: string,
  verificationLink: string
): Promise<boolean> {
  const subject = 'Verify Your Email - Nu Performance Nutrition';
  
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
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">Verify Your Email</h2>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hi ${clientName},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Please verify your email address by clicking the button below.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" style="display: inline-block; background-color: #F59E0B; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">
                This link will expire in 24 hours.
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
Verify Your Email

Hi ${clientName},

Please verify your email address by clicking the link below:

${verificationLink}

This link will expire in 24 hours.

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: clientEmail,
    subject,
    html,
    text,
  });
}
