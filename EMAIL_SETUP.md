# Email Configuration Guide

This application uses email to send password setup invitations to clients. To enable email sending, you need to configure SMTP settings.

## Required Environment Variables

Add these environment variables to enable email sending:

```bash
EMAIL_HOST=smtp.example.com          # Your SMTP server hostname
EMAIL_PORT=587                        # SMTP port (587 for TLS, 465 for SSL)
EMAIL_USER=your-email@example.com    # SMTP username
EMAIL_PASSWORD=your-password          # SMTP password
EMAIL_FROM=Nu Performance Nutrition <noreply@nunutrition.com>  # From address (optional)
VITE_APP_URL=https://your-app-url.com  # Your app's public URL for password setup links
```

## Recommended Email Services

### 1. Gmail (for testing)

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password  # Use App Password, not regular password
```

**Note:** You need to enable "App Passwords" in your Google Account settings.

### 2. SendGrid

```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

### 3. AWS SES

```bash
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com  # Replace with your region
EMAIL_PORT=587
EMAIL_USER=your-smtp-username
EMAIL_PASSWORD=your-smtp-password
```

### 4. Mailgun

```bash
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=postmaster@your-domain.mailgun.org
EMAIL_PASSWORD=your-mailgun-smtp-password
```

## How to Add Environment Variables in Manus

1. Go to **Management UI** → **Settings** → **Secrets**
2. Click **Add Secret**
3. Add each environment variable:
   - Key: `EMAIL_HOST`
   - Value: `smtp.example.com`
4. Repeat for all required variables
5. Restart the application

## Testing Email Configuration

After configuring email settings:

1. Create a new client with a valid email address
2. Check the server logs for email sending status
3. The client should receive an email with a password setup link

## Fallback Behavior

If email is not configured:
- The system will log the invitation details to the console
- Trainers will see a message: "Email not configured. Please manually share the password setup link."
- The password setup token will still be generated and stored in the database
- You can manually share the setup link: `https://your-app-url.com/set-password?token=TOKEN`

## Email Template

The password setup invitation email includes:
- Professional HTML design with Nu Performance branding
- Clear call-to-action button
- Plain text fallback for email clients that don't support HTML
- 24-hour expiration notice
- Direct link to password setup page

## Troubleshooting

### Email not sending

1. Check environment variables are correctly set
2. Verify SMTP credentials are valid
3. Check server logs for error messages
4. Ensure firewall allows outbound connections on the SMTP port

### Emails going to spam

1. Configure SPF, DKIM, and DMARC records for your domain
2. Use a reputable email service (SendGrid, AWS SES, etc.)
3. Avoid using free email services (Gmail, Yahoo) for production

### Invalid password setup links

1. Verify `VITE_APP_URL` is set to your app's public URL
2. Ensure the URL includes the protocol (`https://`)
3. Check that the token hasn't expired (24-hour validity)
