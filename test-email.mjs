/**
 * Quick test script to verify SendGrid email sending
 */

// Load environment variables
import { config } from 'dotenv';
config();

const apiKey = process.env.EMAIL_PASSWORD;
const emailFrom = process.env.EMAIL_FROM;
const testEmail = 'andy@andyknight.asia';

console.log('Testing SendGrid email sending...');
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
console.log('From:', emailFrom);
console.log('To:', testEmail);
console.log('');

if (!apiKey) {
  console.error('❌ EMAIL_PASSWORD not set!');
  process.exit(1);
}

// Parse email address
function parseEmailAddress(emailString) {
  const match = emailString.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: emailString.trim() };
}

// Send test email
async function sendTestEmail() {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: testEmail }],
          },
        ],
        from: parseEmailAddress(emailFrom),
        subject: 'Test Email from Nu Performance Nutrition',
        content: [
          { type: 'text/plain', value: 'This is a test email to verify SendGrid integration.' },
          { type: 'text/html', value: '<p>This is a <strong>test email</strong> to verify SendGrid integration.</p>' },
        ],
      }),
    });

    if (response.ok || response.status === 202) {
      console.log('✅ Email sent successfully!');
      console.log('Status:', response.status);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ SendGrid API error:', response.status);
      console.error('Response:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
}

sendTestEmail();
