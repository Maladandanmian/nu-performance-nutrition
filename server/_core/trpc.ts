import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Helper function to get client session from either cookie or header
function getClientSessionData(ctx: TrpcContext): { clientId: number; name: string } | null {
  // First, try to get from cookie
  const clientCookie = ctx.req.cookies?.['client_session'];
  if (clientCookie) {
    try {
      const decoded = JSON.parse(Buffer.from(clientCookie, 'base64').toString());
      console.log('[getClientSessionData] Found session in cookie:', decoded.clientId);
      return {
        clientId: decoded.clientId,
        name: decoded.name,
      };
    } catch (e) {
      console.log('[getClientSessionData] Failed to decode cookie');
    }
  }

  // Fallback: try to get from X-Client-Session header
  const sessionHeader = ctx.req.headers['x-client-session'] as string | undefined;
  if (sessionHeader) {
    try {
      const decoded = JSON.parse(Buffer.from(sessionHeader, 'base64').toString());
      console.log('[getClientSessionData] Found session in header:', decoded.clientId);
      return {
        clientId: decoded.clientId,
        name: decoded.name,
      };
    } catch (e) {
      console.log('[getClientSessionData] Failed to decode header');
    }
  }

  console.log('[getClientSessionData] No session found in cookie or header');
  return null;
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Middleware for PIN-authenticated clients
const requireClientSession = t.middleware(async opts => {
  const { ctx, next } = opts;

  // Check for client session from cookie or header
  const sessionData = getClientSessionData(ctx);
  if (!sessionData) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Client session required" });
  }

  return next({
    ctx: {
      ...ctx,
      clientSession: sessionData,
    },
  });
});

export const clientProcedure = t.procedure.use(requireClientSession);

// Middleware that accepts EITHER OAuth user OR client session
const requireUserOrClient = t.middleware(async opts => {
  const { ctx, next } = opts;

  // Check for OAuth user first
  if (ctx.user) {
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        clientSession: undefined,
      },
    });
  }

  // Check for client session from cookie or header
  const sessionData = getClientSessionData(ctx);
  if (sessionData) {
    return next({
      ctx: {
        ...ctx,
        user: undefined,
        clientSession: sessionData,
      },
    });
  }

  throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
});

export const authenticatedProcedure = t.procedure.use(requireUserOrClient);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
