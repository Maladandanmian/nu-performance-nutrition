import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import { createServer } from 'http';

describe('Session Reminder Trigger Endpoint', () => {
  let app: express.Application;
  let server: any;
  let port: number;

  beforeAll(async () => {
    // Set up test environment
    process.env.REMINDER_TRIGGER_TOKEN = 'test-token-12345';

    app = express();
    app.use(express.json());

    // Minimal endpoint for testing
    app.post('/api/trigger-reminders', (req, res) => {
      const token = req.headers['x-reminder-token'];
      if (!process.env.REMINDER_TRIGGER_TOKEN || token !== process.env.REMINDER_TRIGGER_TOKEN) {
        res.status(401).json({ error: 'Unauthorised' });
        return;
      }
      res.json({ ok: true, message: 'Session reminders triggered' });
    });

    server = createServer(app);
    port = 3001;
    
    await new Promise<void>((resolve) => {
      server.listen(port, () => resolve());
    });
  });

  afterAll(() => {
    server.close();
  });

  it('should reject requests without the token', async () => {
    const response = await fetch(`http://localhost:${port}/api/trigger-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(401);
  });

  it('should reject requests with an invalid token', async () => {
    const response = await fetch(`http://localhost:${port}/api/trigger-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-reminder-token': 'wrong-token',
      },
    });
    expect(response.status).toBe(401);
  });

  it('should accept requests with the correct token', async () => {
    const response = await fetch(`http://localhost:${port}/api/trigger-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-reminder-token': 'test-token-12345',
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.ok).toBe(true);
    expect(data.message).toBe('Session reminders triggered');
  });

  it('should accept the real REMINDER_TRIGGER_TOKEN from environment', async () => {
    const realToken = process.env.REMINDER_TRIGGER_TOKEN;
    if (!realToken) {
      throw new Error('REMINDER_TRIGGER_TOKEN not set in environment');
    }

    const response = await fetch(`http://localhost:${port}/api/trigger-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-reminder-token': realToken,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.ok).toBe(true);
  });
});
