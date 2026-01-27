/**
 * Audit Logging System
 * Tracks important actions for security and compliance
 */
import { getDb } from './db';
import { auditLogs } from '../drizzle/schema';

export type AuditAction = 
  | 'login_pin'
  | 'login_email'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'email_setup'
  | 'email_verified'
  | 'view_dexa'
  | 'upload_dexa'
  | 'delete_dexa'
  | 'create_meal'
  | 'update_meal'
  | 'delete_meal'
  | 'create_drink'
  | 'update_drink'
  | 'delete_drink'
  | 'update_goals'
  | 'create_client'
  | 'update_client'
  | 'delete_client';

export type ActorType = 'client' | 'trainer' | 'system';
export type ResourceType = 'client' | 'meal' | 'drink' | 'dexa_scan' | 'nutrition_goal' | 'session';

export interface AuditLogEntry {
  actorType: ActorType;
  actorId?: number;
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: number;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn('[AuditLog] Database not available, skipping audit log');
    return;
  }

  try {
    await db.insert(auditLogs).values({
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      details: entry.details ? JSON.stringify(entry.details) : null,
      success: entry.success ?? true,
      errorMessage: entry.errorMessage,
    });
  } catch (error) {
    console.error('[AuditLog] Failed to log audit event:', error);
  }
}

/**
 * Log a successful login
 */
export async function logLogin(
  actorType: ActorType,
  actorId: number,
  authMethod: 'pin' | 'email',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    actorType,
    actorId,
    action: authMethod === 'pin' ? 'login_pin' : 'login_email',
    resourceType: 'session',
    ipAddress,
    userAgent,
    details: { authMethod },
    success: true,
  });
}

/**
 * Log a failed login attempt
 */
export async function logFailedLogin(
  ipAddress?: string,
  userAgent?: string,
  reason?: string
): Promise<void> {
  await logAuditEvent({
    actorType: 'system',
    action: 'login_failed',
    resourceType: 'session',
    ipAddress,
    userAgent,
    details: { reason },
    success: false,
    errorMessage: reason,
  });
}

/**
 * Log a logout
 */
export async function logLogout(
  actorType: ActorType,
  actorId: number,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    actorType,
    actorId,
    action: 'logout',
    resourceType: 'session',
    ipAddress,
    success: true,
  });
}

/**
 * Log DEXA scan access
 */
export async function logDexaAccess(
  actorType: ActorType,
  actorId: number,
  scanId: number,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    actorType,
    actorId,
    action: 'view_dexa',
    resourceType: 'dexa_scan',
    resourceId: scanId,
    ipAddress,
    success: true,
  });
}

/**
 * Log data modification
 */
export async function logDataModification(
  actorType: ActorType,
  actorId: number,
  action: AuditAction,
  resourceType: ResourceType,
  resourceId: number,
  details?: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    actorType,
    actorId,
    action,
    resourceType,
    resourceId,
    ipAddress,
    details,
    success: true,
  });
}

/**
 * Extract IP address from request
 */
export function getIPFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
    return ips[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  return req.ip || '0.0.0.0';
}

/**
 * Extract user agent from request
 */
export function getUserAgentFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const ua = req.headers['user-agent'];
  if (!ua) return 'unknown';
  return Array.isArray(ua) ? ua[0] : ua;
}

/**
 * Get audit logs for a specific actor (client or trainer)
 */
export async function getAuditLogs(
  actorId: number,
  limit: number = 50,
  actorType?: ActorType
): Promise<Array<typeof auditLogs.$inferSelect>> {
  const db = await getDb();
  if (!db) {
    console.warn('[AuditLog] Database not available');
    return [];
  }

  const { eq, desc, and } = await import('drizzle-orm');
  
  const conditions = [eq(auditLogs.actorId, actorId)];
  if (actorType) {
    conditions.push(eq(auditLogs.actorType, actorType));
  }

  return db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
