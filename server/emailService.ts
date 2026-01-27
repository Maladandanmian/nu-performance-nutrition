/**
 * Email Service
 * 
 * Handles sending emails for password setup invitations and other notifications.
 * 
 * Configuration:
 * - Uses nodemailer for SMTP email sending
 * - Requires EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD env vars
 * - Falls back to console.log if email is not configured
 */

import { ENV } from './_core/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email
 * Returns true if email was sent successfully, false otherwise
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Check if email is configured
  const emailHost = process.env.EMAIL_HOST;
  const emailPort = process.env.EMAIL_PORT;
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM || 'Nu Performance Nutrition <noreply@nunutrition.com>';

  // If email is not configured, log to console and return false
  if (!emailHost || !emailUser || !emailPassword) {
    console.log('[EmailService] Email not configured. Would have sent:');
    console.log(`[EmailService] To: ${options.to}`);
    console.log(`[EmailService] Subject: ${options.subject}`);
    console.log(`[EmailService] Body (text): ${options.text || 'N/A'}`);
    console.log(`[EmailService] Body (html): ${options.html}`);
    return false;
  }

  try {
    // Dynamic import nodemailer to avoid loading it if not configured
    const nodemailer = await import('nodemailer');

    // Create transporter
    const transporter = nodemailer.default.createTransport({
      host: emailHost,
      port: parseInt(emailPort || '587'),
      secure: emailPort === '465', // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    // Send email
    await transporter.sendMail({
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log(`[EmailService] Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    return false;
  }
}

/**
 * Send password setup invitation email to a client
 */
export async function sendPasswordSetupInvitation(
  clientEmail: string,
  clientName: string,
  token: string
): Promise<boolean> {
  const setupUrl = `${process.env.VITE_APP_URL || 'https://your-app-url.com'}/set-password?token=${token}`;

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
            <td style="background-color: #578DB3; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">Welcome, ${clientName}!</h2>
              
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Your trainer has created an account for you on Nu Performance Nutrition. To get started, you need to set your password.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Click the button below to set your password and access your nutrition dashboard:
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${setupUrl}" style="display: inline-block; background-color: #578DB3; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 4px; font-size: 16px; font-weight: bold;">Set Your Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 15px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 30px 0; color: #578DB3; font-size: 14px; word-break: break-all;">
                ${setupUrl}
              </p>
              
              <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                <strong>Note:</strong> This link will expire in 24 hours. If you didn't request this account, please contact your trainer.
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
Welcome to Nu Performance Nutrition, ${clientName}!

Your trainer has created an account for you. To get started, you need to set your password.

Click the link below to set your password:
${setupUrl}

This link will expire in 24 hours.

If you didn't request this account, please contact your trainer.

© ${new Date().getFullYear()} Nu Performance Nutrition
  `.trim();

  return sendEmail({
    to: clientEmail,
    subject,
    html,
    text,
  });
}
