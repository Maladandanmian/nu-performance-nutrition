/**
 * One-off script: send a test "last session" alert email.
 * Uses Shirley Dirkin (one of Luke's real clients) as the recipient.
 *
 * Run with:  node scripts/send-test-last-session-alert.mjs
 */

import { createRequire } from "module";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

// Dynamically import the compiled TS helpers via ts-node/esm
// We call the email function directly via a small inline reimplementation
// to avoid needing to compile the full server.

import nodemailer from "nodemailer";

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASSWORD,
  EMAIL_FROM,
} = process.env;

if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASSWORD) {
  console.error("Missing email env vars. Make sure .env is present.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT) || 587,
  secure: Number(EMAIL_PORT) === 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

const session = {
  clientName: "Shirley Dirkin",
  clientEmail: "luke@nuperformancecoaching.com",
  sessionType: "1on1_pt",
  sessionDate: new Date().toISOString().split("T")[0],
  startTime: "15:00",
  endTime: "16:00",
  trainerName: "luke",
  packageType: "1on1_pt",
  sessionsTotal: 10,
};

function formatSessionType(t) {
  const map = {
    "1on1_pt": "1-on-1 Personal Training",
    "2on1_pt": "2-on-1 Personal Training",
    "group_class": "Group Class",
    "online_coaching": "Online Coaching",
    "nutrition_consult": "Nutrition Consultation",
    "conditioning": "Conditioning",
    "strength_conditioning": "Strength & Conditioning",
    "custom": "Custom Session",
  };
  return map[t] || t;
}

function formatDateTime(dateStr, timeStr) {
  try {
    const d = new Date(`${dateStr}T${timeStr}:00`);
    return d.toLocaleString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return `${dateStr} ${timeStr}`;
  }
}

const dateTime = formatDateTime(session.sessionDate, session.startTime);
const subject = "Your Final Session is Booked – Nu Performance Nutrition [TEST]";

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
          <tr>
            <td style="background-color: #E8A838; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Nu Performance Nutrition</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 12px; font-size: 13px; color: #856404; margin: 0 0 24px 0;">
                ⚠️ <strong>TEST EMAIL</strong> — This is a test of the Last Session Alert feature.
              </p>
              <h2 style="margin: 0 0 16px 0; color: #333333; font-size: 20px;">🏋️ Your Final Session is Booked</h2>
              <p style="margin: 0 0 16px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Hi ${session.clientName},
              </p>
              <p style="margin: 0 0 24px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                This session is the <strong>last session in your current package</strong>. We hope you've made great progress — your trainer will be in touch to discuss your next steps and how to keep the momentum going.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef9ec; border-left: 4px solid #E8A838; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px; width: 140px;">Session Type:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${formatSessionType(session.sessionType)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Date &amp; Time:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${dateTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Duration:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.startTime} – ${session.endTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Trainer:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${session.trainerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #999999; font-size: 14px;">Package:</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${formatSessionType(session.packageType)} (${session.sessionsTotal} sessions)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; color: #666666; font-size: 15px; line-height: 1.6;">
                If you'd like to continue training, speak to ${session.trainerName} at your session or reply to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f5f5; padding: 20px 40px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 13px;">© ${new Date().getFullYear()} Nu Performance Nutrition. All rights reserved.</p>
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
[TEST EMAIL]

Your Final Session is Booked

Hi ${session.clientName},

This session is the last session in your current package. Your trainer will be in touch to discuss next steps.

Session Type: ${formatSessionType(session.sessionType)}
Date & Time: ${dateTime}
Duration: ${session.startTime} – ${session.endTime}
Trainer: ${session.trainerName}
Package: ${formatSessionType(session.packageType)} (${session.sessionsTotal} sessions)

Speak to ${session.trainerName} at your session or reply to this email to continue training.

© ${new Date().getFullYear()} Nu Performance Nutrition
`.trim();

try {
  const info = await transporter.sendMail({
    from: EMAIL_FROM || EMAIL_USER,
    to: session.clientEmail,
    subject,
    html,
    text,
  });
  console.log("✅ Test email sent successfully");
  console.log("   To:", session.clientEmail);
  console.log("   Message ID:", info.messageId);
} catch (err) {
  console.error("❌ Failed to send test email:", err.message);
  process.exit(1);
}
