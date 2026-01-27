/**
 * Email/Password Authentication Procedures
 * These procedures handle email-based authentication for clients
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import * as db from "./db";
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  generateSecureToken,
  getPasswordResetExpiry,
  getEmailVerificationExpiry,
  normalizeEmail,
} from "./emailAuth";
import { checkRateLimit, recordLoginAttempt, getClientIP } from "./rateLimit";

/**
 * Email authentication router
 */
export const emailAuthRouter = router({
  /**
   * Register email/password for an existing client
   * Client must verify their PIN first
   */
  setupEmailAuth: publicProcedure
    .input(z.object({
      clientId: z.number(),
      email: z.string().email(),
      password: z.string().min(8),
      currentPin: z.string().length(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const { verifyPIN } = await import("./pinAuth");
      
      // Verify the client exists
      const client = await db.getClientById(input.clientId);
      if (!client) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
      }
      
      // Verify PIN matches
      if (!client.pin) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Client has no PIN set' });
      }
      
      const pinValid = await verifyPIN(input.currentPin, client.pin);
      if (!pinValid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid PIN' });
      }
      
      // Validate password strength
      const passwordValidation = validatePassword(input.password);
      if (!passwordValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join('. '),
        });
      }
      
      // Check if email is already in use
      const normalizedEmail = normalizeEmail(input.email);
      const existingClient = await db.getClientByEmail(normalizedEmail);
      if (existingClient && existingClient.id !== input.clientId) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already in use' });
      }
      
      // Hash password and update client
      const passwordHash = await hashPassword(input.password);
      await db.updateClientAuth(input.clientId, {
        email: normalizedEmail,
        passwordHash,
        authMethod: 'both',
      });
      
      // Generate email verification token
      const token = generateSecureToken();
      await db.createEmailVerificationToken({
        clientId: input.clientId,
        token,
        expiresAt: getEmailVerificationExpiry(),
      });
      
      console.log('[EmailAuth] Verification token for client ' + input.clientId + ': ' + token);
      
      return {
        success: true,
        message: 'Email authentication set up. Please check your email to verify.',
      };
    }),

  /**
   * Login with email and password
   */
  loginWithEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const clientIP = getClientIP(ctx.req);
      
      // Check rate limit
      const rateLimitStatus = await checkRateLimit(clientIP);
      if (rateLimitStatus.isLocked) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many failed login attempts. Please try again in ' + rateLimitStatus.remainingMinutes + ' minutes.',
        });
      }
      
      // Find client by email
      const normalizedEmail = normalizeEmail(input.email);
      const client = await db.getClientByEmail(normalizedEmail);
      
      if (!client || !client.passwordHash) {
        await recordLoginAttempt(clientIP, false);
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }
      
      // Verify password
      const passwordValid = await verifyPassword(input.password, client.passwordHash);
      if (!passwordValid) {
        await recordLoginAttempt(clientIP, false);
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }
      
      // Check if email is verified
      if (!client.emailVerified) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Please verify your email before logging in',
        });
      }
      
      // Record successful login
      await recordLoginAttempt(clientIP, true);
      
      // Create session
      const sessionData = JSON.stringify({
        clientId: client.id,
        name: client.name,
        type: 'client',
        authMethod: 'email',
        timestamp: Date.now(),
      });
      
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const cookieValue = Buffer.from(sessionData).toString('base64');
      
      ctx.res.cookie('client_session', cookieValue, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
      });
      
      return {
        success: true,
        client: {
          id: client.id,
          name: client.name,
        },
        sessionToken: cookieValue,
      };
    }),

  /**
   * Verify email address
   */
  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ input }) => {
      const tokenRecord = await db.getEmailVerificationToken(input.token);
      
      if (!tokenRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid verification token' });
      }
      
      if (tokenRecord.used) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token has already been used' });
      }
      
      if (new Date() > tokenRecord.expiresAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token has expired' });
      }
      
      // Mark email as verified
      await db.verifyClientEmail(tokenRecord.clientId);
      await db.markEmailVerificationTokenUsed(input.token);
      
      return { success: true, message: 'Email verified successfully' };
    }),

  /**
   * Request password reset
   */
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      const client = await db.getClientByEmail(normalizedEmail);
      
      // Always return success to prevent email enumeration
      if (!client) {
        return { success: true, message: 'If an account exists, a reset link has been sent.' };
      }
      
      // Generate reset token
      const token = generateSecureToken();
      await db.createPasswordResetToken({
        clientId: client.id,
        token,
        expiresAt: getPasswordResetExpiry(),
      });
      
      // TODO: Send password reset email
      console.log('[EmailAuth] Password reset token for client ' + client.id + ': ' + token);
      
      return { success: true, message: 'If an account exists, a reset link has been sent.' };
    }),

  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const tokenRecord = await db.getPasswordResetToken(input.token);
      
      if (!tokenRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid reset token' });
      }
      
      if (tokenRecord.used) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token has already been used' });
      }
      
      if (new Date() > tokenRecord.expiresAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token has expired' });
      }
      
      // Validate new password
      const passwordValidation = validatePassword(input.newPassword);
      if (!passwordValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join('. '),
        });
      }
      
      // Hash and update password
      const passwordHash = await hashPassword(input.newPassword);
      await db.updateClientPassword(tokenRecord.clientId, passwordHash);
      await db.markPasswordResetTokenUsed(input.token);
      
      return { success: true, message: 'Password reset successfully' };
    }),

  /**
   * Change password (for logged-in users)
   */
  changePassword: publicProcedure
    .input(z.object({
      clientId: z.number(),
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const client = await db.getClientById(input.clientId);
      
      if (!client || !client.passwordHash) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found or no password set' });
      }
      
      // Verify current password
      const passwordValid = await verifyPassword(input.currentPassword, client.passwordHash);
      if (!passwordValid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
      }
      
      // Validate new password
      const passwordValidation = validatePassword(input.newPassword);
      if (!passwordValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join('. '),
        });
      }
      
      // Hash and update password
      const passwordHash = await hashPassword(input.newPassword);
      await db.updateClientPassword(input.clientId, passwordHash);
      
      return { success: true, message: 'Password changed successfully' };
    }),

  /**
   * Resend verification email
   */
  resendVerificationEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      const client = await db.getClientByEmail(normalizedEmail);
      
      if (!client) {
        return { success: true, message: 'If an account exists, a verification email has been sent.' };
      }
      
      if (client.emailVerified) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email is already verified' });
      }
      
      // Generate new verification token
      const token = generateSecureToken();
      await db.createEmailVerificationToken({
        clientId: client.id,
        token,
        expiresAt: getEmailVerificationExpiry(),
      });
      
      // TODO: Send verification email
      console.log('[EmailAuth] New verification token for client ' + client.id + ': ' + token);
      
      return { success: true, message: 'If an account exists, a verification email has been sent.' };
    }),

  /**
   * Set client password using invitation token
   * Called by client after receiving email invitation
   */
  setPasswordWithToken: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      // Verify token is valid and not expired
      const client = await db.verifyPasswordSetupToken(input.token);
      if (!client) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Invalid or expired password setup link. Please contact your trainer for a new invitation.' 
        });
      }
      
      // Validate password strength
      const passwordValidation = validatePassword(input.password);
      if (!passwordValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join('. '),
        });
      }
      
      // Hash password and update client
      const passwordHash = await hashPassword(input.password);
      await db.updateClient(client.id, {
        passwordHash,
        emailVerified: true, // Mark email as verified since trainer provided it
        authMethod: 'email',
      });
      
      // Clear the password setup token
      await db.clearPasswordSetupToken(client.id);
      
      return {
        success: true,
        message: 'Password set successfully. You can now log in with your email.',
        clientId: client.id,
      };
    }),

  /**
   * Get password setup link status
   * Used to check if token is valid before showing password setup form
   */
  checkPasswordSetupToken: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .query(async ({ input }) => {
      const client = await db.verifyPasswordSetupToken(input.token);
      if (!client) {
        return {
          valid: false,
          message: 'Invalid or expired password setup link',
        };
      }
      
      return {
        valid: true,
        clientName: client.name,
        clientEmail: client.email,
      };
    }),
});
