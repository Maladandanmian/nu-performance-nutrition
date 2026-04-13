import { router } from "./_core/trpc";
import { publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as invoiceDb from "./invoiceDb";
import * as db from "./db";
import { sendInvoiceEmail } from "./invoiceEmailService";
import { InvoiceLineItem } from "../drizzle/schema";

// Admin-only procedure for trainers
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only trainers can access this resource" });
  }
  return next({ ctx });
});

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
});

export const invoiceRouter = router({
  /**
   * Generate a draft invoice pre-populated from a package
   * Returns the new invoice ID
   */
  generate: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        packageId: z.number().optional(),
        packageType: z.string().optional(),
        sessionsTotal: z.number().optional(),
        pricePerSession: z.number().optional(), // Pre-populate unit price from package
        currency: z.string().default("HKD"),
        notes: z.string().optional(),
        dueDate: z.string().optional(), // YYYY-MM-DD
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoiceNumber = await invoiceDb.generateInvoiceNumber();

      // Build default line item from package
      const lineItems: InvoiceLineItem[] = [];
      if (input.packageType && input.sessionsTotal) {
        const unitPrice = input.pricePerSession ?? 0;
        lineItems.push({
          description: input.packageType,
          quantity: input.sessionsTotal,
          unitPrice,
          total: Math.round(input.sessionsTotal * unitPrice * 100) / 100,
        });
      }

      const { subtotal, taxAmount, total } = invoiceDb.calculateInvoiceTotals(lineItems, 0);

      const invoiceId = await invoiceDb.createInvoice({
        trainerId: ctx.user.id,
        clientId: input.clientId,
        packageId: input.packageId ?? null,
        invoiceNumber,
        lineItems,
        subtotal: String(subtotal) as any,
        taxRate: "0.00" as any,
        taxAmount: String(taxAmount) as any,
        total: String(total) as any,
        currency: input.currency,
        status: "draft",
        notes: input.notes ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      });

      return { invoiceId, invoiceNumber };
    }),

  /**
   * Update invoice line items and recalculate totals
   */
  update: adminProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        lineItems: z.array(lineItemSchema).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        notes: z.string().optional().nullable(),
        dueDate: z.string().optional().nullable(),
        currency: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      const lineItems = (input.lineItems ?? (existing.lineItems as InvoiceLineItem[]));
      const taxRate = input.taxRate ?? parseFloat(String(existing.taxRate || "0"));
      const { subtotal, taxAmount, total } = invoiceDb.calculateInvoiceTotals(lineItems, taxRate);

      await invoiceDb.updateInvoice(input.invoiceId, {
        lineItems,
        subtotal: String(subtotal) as any,
        taxRate: String(taxRate) as any,
        taxAmount: String(taxAmount) as any,
        total: String(total) as any,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existing.dueDate,
        currency: input.currency ?? existing.currency,
      });

      return { success: true };
    }),

  /**
   * Send invoice to client via email and mark as sent
   */
  send: adminProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      // Get client details
      const client = await db.getClientById(invoice.clientId);
      if (!client || !client.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client does not have an email address on file",
        });
      }

      // Get package type if linked
      let packageType: string | undefined;
      if (invoice.packageId) {
        const pkg = await db.getSessionPackageById(invoice.packageId);
        packageType = pkg?.packageType;
      }

      const result = await sendInvoiceEmail({
        invoice,
        clientName: client.name,
        clientEmail: client.email,
        trainerName: ctx.user.name || "Your Trainer",
        packageType,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send invoice: ${result.error}`,
        });
      }

      await invoiceDb.markInvoiceSent(invoice.id);

      return { success: true, sentTo: client.email };
    }),

  /**
   * Get all invoices for the trainer (for the invoices monitoring page)
   */
  listByTrainer: adminProcedure.query(async ({ ctx }) => {
    return invoiceDb.getInvoicesByTrainer(ctx.user.id);
  }),

  /**
   * Get invoices for a specific client
   */
  listByClient: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return invoiceDb.getInvoicesByClient(input.clientId);
    }),

  /**
   * Get invoices for a specific package
   */
  listByPackage: adminProcedure
    .input(z.object({ packageId: z.number() }))
    .query(async ({ input }) => {
      return invoiceDb.getInvoicesByPackage(input.packageId);
    }),

  /**
   * Get a single invoice by ID
   */
  getById: adminProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ input }) => {
      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      return invoice;
    }),

  /**
   * Mark a sent invoice as paid
   */
  markPaid: adminProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only sent invoices can be marked as paid",
        });
      }
      await invoiceDb.markInvoicePaid(input.invoiceId);
      return { success: true };
    }),

  /**
   * Delete a draft invoice
   */
  delete: adminProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const invoice = await invoiceDb.getInvoiceById(input.invoiceId);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.status === "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete a sent invoice",
        });
      }
      await invoiceDb.deleteInvoice(input.invoiceId);
      return { success: true };
    }),
});
