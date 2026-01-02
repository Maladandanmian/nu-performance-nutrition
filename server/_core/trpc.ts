import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

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

  // Check for client_session cookie
  const clientCookie = ctx.req.cookies?.['client_session'];
  if (!clientCookie) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Client session required" });
  }

  try {
    const decoded = JSON.parse(Buffer.from(clientCookie, 'base64').toString());
    return next({
      ctx: {
        ...ctx,
        clientSession: {
          clientId: decoded.clientId,
          name: decoded.name,
        },
      },
    });
  } catch (e) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid client session" });
  }
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

  // Check for client session
  const clientCookie = ctx.req.cookies?.['client_session'];
  if (clientCookie) {
    try {
      const decoded = JSON.parse(Buffer.from(clientCookie, 'base64').toString());
      return next({
        ctx: {
          ...ctx,
          user: undefined,
          clientSession: {
            clientId: decoded.clientId,
            name: decoded.name,
          },
        },
      });
    } catch (e) {
      // Fall through to unauthorized
    }
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
