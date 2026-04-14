import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { hashPassword, verifyPassword } from "./emailAuth";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";

export const emailAuthRouter = router({
  /**
   * Client login with email and password
   */
  loginWithEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const client = await db.getClientByEmail(input.email);
      if (!client || !client.passwordHash) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      const passwordValid = await verifyPassword(input.password, client.passwordHash);
      if (!passwordValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Create session token — must include name for clientSession validation
      const sessionToken = Buffer.from(JSON.stringify({
        clientId: client.id,
        name: client.name,
        timestamp: Date.now(),
      })).toString('base64');

      // Set session cookie using the correct cookie name (client_session)
      const cookieOpts = getSessionCookieOptions(ctx.req);
      const cookieStr = `client_session=${sessionToken}; Path=${cookieOpts.path}; SameSite=${cookieOpts.sameSite}; ${cookieOpts.secure ? 'Secure' : ''}; HttpOnly; Max-Age=${7 * 24 * 60 * 60}`;
      ctx.res.setHeader('Set-Cookie', cookieStr);

      return {
        success: true,
        clientId: client.id,
        clientName: client.name,
      };
    }),

  /**
   * Verify password setup token and set password
   */
  setPasswordWithToken: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const client = await db.verifyPasswordSetupToken(input.token);
      if (!client) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired password setup link',
        });
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Update client with password and mark email as verified
      await db.updateClientAuth(client.id, {
        passwordHash,
        authMethod: 'email',
      });

      // Mark email as verified
      await db.verifyClientEmail(client.id);

      // Clear the token
      await db.clearPasswordSetupToken(client.id);

      // Create session token — must include name for clientSession validation
      const sessionToken = Buffer.from(JSON.stringify({
        clientId: client.id,
        name: client.name,
        timestamp: Date.now(),
      })).toString('base64');

      // Set session cookie using the correct cookie name (client_session)
      const cookieOpts = getSessionCookieOptions(ctx.req);
      const cookieStr = `client_session=${sessionToken}; Path=${cookieOpts.path}; SameSite=${cookieOpts.sameSite}; ${cookieOpts.secure ? 'Secure' : ''}; HttpOnly; Max-Age=${7 * 24 * 60 * 60}`;
      ctx.res.setHeader('Set-Cookie', cookieStr);

      return {
        success: true,
        clientId: client.id,
        clientName: client.name,
      };
    }),

  /**
   * Get password setup link status
   * Used to check if token is valid before showing password setup form
   * Returns: { valid, expired, clientName?, clientEmail?, expiresAt? }
   */
  checkPasswordSetupToken: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .query(async ({ input }) => {
      const status = await db.checkPasswordSetupTokenStatus(input.token);

      if (!status.valid) {
        if (status.expired) {
          return {
            valid: false,
            expired: true,
            message: 'This password setup link has expired',
          };
        }
        return {
          valid: false,
          expired: false,
          message: 'Invalid password setup link',
        };
      }

      return {
        valid: true,
        expired: false,
        clientName: status.client?.name,
        clientEmail: status.client?.email,
        expiresAt: status.client?.passwordSetupTokenExpires,
      };
    }),
});
