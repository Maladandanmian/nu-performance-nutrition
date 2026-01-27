/**
 * Rate limiting utilities for login protection
 * Implements IP-based rate limiting with lockout after failed attempts
 */
import { getDb } from './db';
import { loginAttempts, rateLimitLocks } from '../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 15;

/**
 * Check if an IP address is currently locked out
 * @param ipAddress - The IP address to check
 * @returns Object with isLocked status and remainingMinutes if locked
 */
export async function checkRateLimit(ipAddress: string): Promise<{
  isLocked: boolean;
  remainingMinutes?: number;
  failedAttempts?: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn('[RateLimit] Database not available, allowing request');
    return { isLocked: false };
  }

  try {
    // Check for existing lock
    const locks = await db.select()
      .from(rateLimitLocks)
      .where(eq(rateLimitLocks.ipAddress, ipAddress))
      .limit(1);

    if (locks.length > 0) {
      const lock = locks[0];
      const now = new Date();
      
      if (lock.lockedUntil > now) {
        // Still locked
        const remainingMs = lock.lockedUntil.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return {
          isLocked: true,
          remainingMinutes,
          failedAttempts: lock.failedAttempts,
        };
      } else {
        // Lock expired, remove it
        await db.delete(rateLimitLocks)
          .where(eq(rateLimitLocks.ipAddress, ipAddress));
      }
    }

    // Count recent failed attempts
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);
    const recentAttempts = await db.select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, windowStart)
        )
      );

    const failedCount = Number(recentAttempts[0]?.count || 0);
    
    return {
      isLocked: false,
      failedAttempts: failedCount,
    };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    return { isLocked: false };
  }
}

/**
 * Record a login attempt
 * @param ipAddress - The IP address making the attempt
 * @param success - Whether the login was successful
 * @param attemptedPin - The PIN that was attempted (only last 2 digits stored)
 */
export async function recordLoginAttempt(
  ipAddress: string,
  success: boolean,
  attemptedPin?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn('[RateLimit] Database not available, skipping attempt recording');
    return;
  }

  try {
    // Record the attempt (store only last 2 digits for debugging)
    const maskedPin = attemptedPin ? `****${attemptedPin.slice(-2)}` : undefined;
    
    await db.insert(loginAttempts).values({
      ipAddress,
      attemptedPin: maskedPin?.slice(-2), // Only last 2 digits
      success,
    });

    if (success) {
      // Clear any existing lock on successful login
      await db.delete(rateLimitLocks)
        .where(eq(rateLimitLocks.ipAddress, ipAddress));
      return;
    }

    // Check if we need to create a lock
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);
    const recentAttempts = await db.select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, windowStart)
        )
      );

    const failedCount = Number(recentAttempts[0]?.count || 0);

    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      // Create or update lock
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      
      await db.insert(rateLimitLocks)
        .values({
          ipAddress,
          lockedUntil,
          failedAttempts: failedCount,
        })
        .onDuplicateKeyUpdate({
          set: {
            lockedUntil,
            failedAttempts: failedCount,
          },
        });
      
      console.log(`[RateLimit] IP ${ipAddress} locked until ${lockedUntil.toISOString()} after ${failedCount} failed attempts`);
    }
  } catch (error) {
    console.error('[RateLimit] Error recording login attempt:', error);
  }
}

/**
 * Get the client's real IP address from request headers
 * Handles proxies and load balancers
 */
export function getClientIP(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  // Check X-Forwarded-For header (common for proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
    return ips[0].trim();
  }
  
  // Check X-Real-IP header (nginx)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  // Fall back to request IP
  return req.ip || '0.0.0.0';
}
