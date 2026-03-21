import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
// import cron from "node-cron"; // Disabled: causing duplicate backups due to timezone issues
import { createAndEmailBackup } from "../backup";
import { sendSessionReminders } from "../sessionReminderService";
import { getUserByOpenId, getLastBackupLog } from "../db";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Resolves the owner's trainer ID from the database.
 * Used to attribute backup log entries to the correct trainer.
 */
async function getOwnerTrainerId(): Promise<number | undefined> {
  if (!ENV.ownerOpenId) return undefined;
  const owner = await getUserByOpenId(ENV.ownerOpenId).catch(() => undefined);
  return owner?.id;
}

/**
 * Runs a backup and logs the result.
 * Safe to call from any context (cron, HTTP trigger, startup check).
 */
async function runBackup(source: string): Promise<void> {
  console.log(`[Backup] Running backup (source: ${source})...`);
  try {
    const trainerId = await getOwnerTrainerId();
    const result = await createAndEmailBackup('lukusdavey@gmail.com', trainerId);
    if (result.success) {
      console.log(`[Backup] Backup sent successfully (source: ${source})`);
    } else {
      console.error(`[Backup] Backup failed (source: ${source}):`, result.message);
    }
  } catch (error) {
    console.error(`[Backup] Unexpected error (source: ${source}):`, error);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure cookie parser
  app.use(cookieParser());
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ── Option 2: External HTTP trigger endpoint ──────────────────────────────
  // Called by cron-job.org at 23:59 HKT daily via:
  //   POST /api/trigger-backup
  //   Header: x-backup-token: <BACKUP_TRIGGER_TOKEN>
  app.post('/api/trigger-backup', async (req, res) => {
    const token = req.headers['x-backup-token'];
    if (!ENV.backupTriggerToken || token !== ENV.backupTriggerToken) {
      console.warn('[Backup] Unauthorised trigger attempt from', req.ip);
      res.status(401).json({ error: 'Unauthorised' });
      return;
    }
    // Respond immediately so the external cron service doesn't time out
    res.json({ ok: true, message: 'Backup triggered' });
    // Run backup asynchronously after responding
    runBackup('http-trigger');
  });

  // Session Reminder Trigger
  // Called by cron-job.org daily to send 24-hour reminder emails
  app.post('/api/trigger-reminders', async (req, res) => {
    const token = req.headers['x-reminder-token'];
    if (!ENV.reminderTriggerToken || token !== ENV.reminderTriggerToken) {
      console.warn('[SessionReminders] Unauthorised trigger attempt from', req.ip);
      res.status(401).json({ error: 'Unauthorised' });
      return;
    }
    // Respond immediately so the external cron service doesn't time out
    res.json({ ok: true, message: 'Session reminders triggered' });
    // Run reminders asynchronously after responding
    try {
      const result = await sendSessionReminders();
      console.log(`[SessionReminders] Triggered: ${result.sessionRemindersSent} session reminders, ${result.groupClassRemindersSent} group class reminders sent`);
      if (result.errors.length > 0) {
        console.error('[SessionReminders] Errors during reminder dispatch:', result.errors);
      }
    } catch (error) {
      console.error('[SessionReminders] Unexpected error during trigger:', error);
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // ── Option 1: Startup catch-up check ─────────────────────────────────────
  // DISABLED: Was triggering unwanted backups on every server restart due to Manus
  // performing frequent maintenance restarts overnight. The external cron-job.org trigger
  // at 11:59 PM is reliable and sufficient. If backups are missed, they can be triggered
  // manually via the "Run Backup Now" button (with 1-hour cooldown).
  // 
  // if (process.env.ENABLE_STARTUP_BACKUP_CHECK === 'true') {
  //   setTimeout(async () => { ... }, 5000);
  // }
}

startServer().catch(console.error);

// ── Backup trigger mechanisms ──────────────────────────────────────────────
// PRIMARY: External HTTP trigger from cron-job.org at 23:59 HKT daily (POST /api/trigger-backup)
// FALLBACK: Startup catch-up check (if last backup > 20 hours old)
//
// NOTE: In-process cron.schedule() was disabled due to timezone handling issues
// causing duplicate backups. node-cron was not respecting the Asia/Hong_Kong timezone
// and was firing multiple times per hour. Rely on external trigger instead.

console.log('[Backup] Backup triggers: HTTP trigger (primary) + startup catch-up (fallback)');
