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
import cron from "node-cron";
import { createAndEmailBackup } from "../backup";
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
  // If the server restarts and the last backup is more than 20 hours old,
  // run a backup immediately rather than waiting for the next cron window.
  // Runs 5 seconds after startup to avoid blocking the server boot.
  setTimeout(async () => {
    try {
      const trainerId = await getOwnerTrainerId();
      const lastLog = trainerId ? await getLastBackupLog(trainerId).catch(() => undefined) : undefined;
      const twentyHoursMs = 20 * 60 * 60 * 1000;
      const lastBackupTime = lastLog?.backupDate ? new Date(lastLog.backupDate).getTime() : 0;
      const hoursSinceLast = Math.round((Date.now() - lastBackupTime) / 3600000);

      if (Date.now() - lastBackupTime > twentyHoursMs) {
        console.log(`[Backup] Startup check: last backup was ${hoursSinceLast}h ago — running catch-up backup`);
        runBackup('startup-catchup');
      } else {
        console.log(`[Backup] Startup check: last backup was ${hoursSinceLast}h ago — no catch-up needed`);
      }
    } catch (error) {
      console.error('[Backup] Startup check error:', error);
    }
  }, 5000);
}

startServer().catch(console.error);

// ── Fallback in-process cron ──────────────────────────────────────────────
// This fires at 23:59 HKT if the process is alive at that time.
// The external HTTP trigger from cron-job.org is the primary mechanism;
// this is a secondary fallback in case the external trigger fails.
cron.schedule('0 59 23 * * *', () => {
  runBackup('cron');
}, {
  timezone: 'Asia/Hong_Kong'
});

console.log('[Backup] Daily backup scheduled for 11:59 PM HKT (cron + HTTP trigger + startup catch-up)');
