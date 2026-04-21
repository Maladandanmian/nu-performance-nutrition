/**
 * Accounting Router
 * All procedures are restricted to Luke's email address (luke@nuperformancecoaching.com).
 * This router handles: Taxman Report, Monthly Overview (costs), Remaining Packages report.
 */
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, gte, lte, ne, isNotNull } from "drizzle-orm";
import { invoices, trainingSessions, clients, sessionPackages } from "../drizzle/schema";
import * as businessCostsDb from "./businessCostsDb";
import * as invoiceDb from "./invoiceDb";

const LUKE_EMAIL = "luke@nuperformancecoaching.com";

// Luke-only procedure
const lukeProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.email !== LUKE_EMAIL) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access restricted" });
  }
  return next({ ctx });
});

let _db: ReturnType<typeof drizzle> | null = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (e) {
      _db = null;
    }
  }
  return _db;
}

// ── Session type → display label mapping ─────────────────────────────────────

function sessionTypeToServiceLabel(sessionType: string): string {
  const map: Record<string, string> = {
    "1on1_pt": "1-on-1 Personal Training",
    "2on1_pt": "2-on-1 Personal Training",
    "nutrition_coaching": "Nutrition Coaching Session",
    "custom": "Custom Session",
  };
  return map[sessionType] ?? sessionType;
}

export const accountingRouter = router({
  /**
   * Taxman Report
   * Returns revenue rows from:
   *   1. Paid invoices (with paidAt date)
   *   2. PAYG sessions marked paid (with paidAt date and amountPaid)
   * Excludes: nutrition_initial sessions, cancelled sessions, draft/unpaid invoices
   */
  taxmanReport: lukeProcedure
    .input(
      z.object({
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string(),   // YYYY-MM-DD
        serviceType: z.string().optional(), // filter by service type
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const start = new Date(input.startDate);
      const end = new Date(input.endDate + "T23:59:59");

      // ── 1. Paid invoices ─────────────────────────────────────────────────────
      const paidInvoices = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.trainerId, ctx.user.id),
            eq(invoices.status, "paid"),
            isNotNull(invoices.paidAt),
            gte(invoices.paidAt as any, start),
            lte(invoices.paidAt as any, end)
          )
        );

      // Fetch client names for invoices
      const invoiceRows = await Promise.all(
        paidInvoices.map(async (inv) => {
          const [client] = await db
            .select({ name: clients.name })
            .from(clients)
            .where(eq(clients.id, inv.clientId))
            .limit(1);

          const subtotal = parseFloat(String(inv.subtotal || "0"));
          const discount = parseFloat(String(inv.discountAmount || "0"));
          const netAmount = parseFloat(String(inv.total || "0"));

          return {
            source: "invoice" as const,
            date: inv.paidAt!,
            clientName: client?.name ?? "Unknown",
            serviceType: inv.serviceType ?? "Package",
            grossAmount: subtotal,
            discountApplied: discount,
            netAmount,
            invoiceNumber: inv.invoiceNumber,
            sessionId: null,
          };
        })
      );

      // ── 2. PAYG sessions marked paid ─────────────────────────────────────────
      const paygSessions = await db
        .select()
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.trainerId, ctx.user.id),
            eq(trainingSessions.paymentStatus, "paid"),
            eq(trainingSessions.cancelled, false),
            ne(trainingSessions.sessionType as any, "nutrition_initial"),
            isNotNull(trainingSessions.paidAt),
            isNotNull(trainingSessions.amountPaid),
            gte(trainingSessions.paidAt as any, start),
            lte(trainingSessions.paidAt as any, end)
          )
        );

      const sessionRows = await Promise.all(
        paygSessions.map(async (s) => {
          const [client] = await db
            .select({ name: clients.name })
            .from(clients)
            .where(eq(clients.id, s.clientId))
            .limit(1);

          const fee = parseFloat(String(s.sessionFee || "0"));
          const paid = parseFloat(String(s.amountPaid || "0"));
          const discount = Math.max(0, fee - paid);

          return {
            source: "session" as const,
            date: s.paidAt!,
            clientName: client?.name ?? "Unknown",
            serviceType: sessionTypeToServiceLabel(s.sessionType),
            grossAmount: fee || paid,
            discountApplied: discount,
            netAmount: paid,
            invoiceNumber: null,
            sessionId: s.id,
          };
        })
      );

      // ── Combine, filter, sort ─────────────────────────────────────────────────
      let allRows = [...invoiceRows, ...sessionRows];

      if (input.serviceType) {
        allRows = allRows.filter((r) =>
          r.serviceType.toLowerCase().includes(input.serviceType!.toLowerCase())
        );
      }

      allRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalNet = allRows.reduce((sum, r) => sum + r.netAmount, 0);
      const totalGross = allRows.reduce((sum, r) => sum + r.grossAmount, 0);
      const totalDiscount = allRows.reduce((sum, r) => sum + r.discountApplied, 0);

      return {
        rows: allRows,
        totals: { grossAmount: totalGross, discountApplied: totalDiscount, netAmount: totalNet },
      };
    }),

  /**
   * Monthly Overview
   * Returns revenue and costs for a given month (YYYY-MM)
   */
  monthlyOverview: lukeProcedure
    .input(z.object({ month: z.string() })) // YYYY-MM
    .query(async ({ ctx, input }) => {
      const { month } = input;
      const [year, m] = month.split("-").map(Number);
      const startDate = `${month}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;

      // Seed month if not yet seeded
      await businessCostsDb.seedMonthFromPrevious(ctx.user.id, month);

      // Get revenue via taxmanReport logic (reuse same date range)
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const start = new Date(startDate);
      const end = new Date(endDate + "T23:59:59");

      const paidInvoices = await db
        .select({ total: invoices.total })
        .from(invoices)
        .where(
          and(
            eq(invoices.trainerId, ctx.user.id),
            eq(invoices.status, "paid"),
            isNotNull(invoices.paidAt),
            gte(invoices.paidAt as any, start),
            lte(invoices.paidAt as any, end)
          )
        );

      const paygSessions = await db
        .select({ amountPaid: trainingSessions.amountPaid })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.trainerId, ctx.user.id),
            eq(trainingSessions.paymentStatus, "paid"),
            eq(trainingSessions.cancelled, false),
            ne(trainingSessions.sessionType as any, "nutrition_initial"),
            isNotNull(trainingSessions.paidAt),
            isNotNull(trainingSessions.amountPaid),
            gte(trainingSessions.paidAt as any, start),
            lte(trainingSessions.paidAt as any, end)
          )
        );

      const totalRevenue =
        paidInvoices.reduce((s, r) => s + parseFloat(String(r.total || "0")), 0) +
        paygSessions.reduce((s, r) => s + parseFloat(String(r.amountPaid || "0")), 0);

      // Get costs
      const costs = await businessCostsDb.getCostsByMonth(ctx.user.id, month);
      const totalCosts = costs.reduce((s, c) => s + parseFloat(String(c.amount)), 0);

      return {
        month,
        totalRevenue,
        totalCosts,
        netProfit: totalRevenue - totalCosts,
        costs,
        isConfirmed: costs.length > 0 && costs.every((c) => c.confirmedAt !== null),
      };
    }),

  /**
   * Remaining Packages Report
   * Returns all active packages with sessions used, remaining, value of remaining sessions
   */
  remainingPackages: lukeProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const packages = await db
      .select()
      .from(sessionPackages)
      .where(
        eq(sessionPackages.trainerId, ctx.user.id)
      );

    const rows = await Promise.all(
      packages.map(async (pkg) => {
        const [client] = await db
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, pkg.clientId))
          .limit(1);

        // Count sessions used (completed, not cancelled, from this package)
        const usedSessions = await db
          .select({ id: trainingSessions.id })
          .from(trainingSessions)
          .where(
            and(
              eq(trainingSessions.packageId, pkg.id),
              eq(trainingSessions.paymentStatus, "from_package"),
              eq(trainingSessions.cancelled, false)
            )
          );

        const sessionsUsed = usedSessions.length;
        const sessionsTotal = pkg.sessionsTotal ?? 0;
        const sessionsRemaining = Math.max(0, sessionsTotal - sessionsUsed);
        const pricePerSession = parseFloat(String(pkg.pricePerSession || "0"));
        const valueRemaining = sessionsRemaining * pricePerSession;

        return {
          packageId: pkg.id,
          clientName: client?.name ?? "Unknown",
          packageType: pkg.packageType,
          sessionsTotal,
          sessionsUsed,
          sessionsRemaining,
          pricePerSession,
          valueRemaining,
          expiryDate: pkg.expiryDate,
          purchaseDate: pkg.purchaseDate,
        };
      })
    );

    // Sort by sessions remaining ascending (most urgent first)
    rows.sort((a, b) => a.sessionsRemaining - b.sessionsRemaining);

    return rows;
  }),

  // ── Business Costs CRUD ───────────────────────────────────────────────────────

  getCosts: lukeProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ ctx, input }) => {
      await businessCostsDb.seedMonthFromPrevious(ctx.user.id, input.month);
      return businessCostsDb.getCostsByMonth(ctx.user.id, input.month);
    }),

  addCost: lukeProcedure
    .input(
      z.object({
        month: z.string(),
        category: z.enum(["Rent", "Software Subscriptions", "Insurance", "Equipment", "Marketing", "Other"]),
        description: z.string().min(1),
        amount: z.number().min(0),
        isRecurring: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await businessCostsDb.addCost({
        trainerId: ctx.user.id,
        category: input.category,
        description: input.description,
        amount: input.amount,
        isRecurring: input.isRecurring,
        month: input.month,
      });
      return { id };
    }),

  updateCost: lukeProcedure
    .input(
      z.object({
        id: z.number(),
        amount: z.number().min(0).optional(),
        description: z.string().min(1).optional(),
        isRecurring: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await businessCostsDb.updateCost(input.id, ctx.user.id, {
        amount: input.amount,
        description: input.description,
        isRecurring: input.isRecurring,
      });
      return { success: true };
    }),

  deleteCost: lukeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await businessCostsDb.deleteCost(input.id, ctx.user.id);
      return { success: true };
    }),

  confirmMonth: lukeProcedure
    .input(z.object({ month: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await businessCostsDb.confirmMonth(ctx.user.id, input.month);
      return { success: true };
    }),
});
