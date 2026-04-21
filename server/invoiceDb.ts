import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc, and } from "drizzle-orm";
import { invoices, Invoice, InsertInvoice, InvoiceLineItem, serviceTypes } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[InvoiceDb] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Invoice number generation ─────────────────────────────────────────────────

export async function generateInvoiceNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const allInvoices = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices);

  const thisYearInvoices = allInvoices.filter((r: { invoiceNumber: string }) =>
    r.invoiceNumber.startsWith(prefix)
  );

  const nextSeq = thisYearInvoices.length + 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createInvoice(data: InsertInvoice): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [result] = await db.insert(invoices).values(data);
  return (result as any).insertId;
}

export async function getInvoiceById(id: number): Promise<Invoice | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  return result[0];
}

export async function getInvoicesByTrainer(trainerId: number): Promise<Invoice[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(invoices)
    .where(eq(invoices.trainerId, trainerId))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoicesByClient(clientId: number): Promise<Invoice[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, clientId))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoicesByPackage(packageId: number): Promise<Invoice[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(invoices)
    .where(eq(invoices.packageId, packageId))
    .orderBy(desc(invoices.createdAt));
}

export async function updateInvoice(
  id: number,
  data: Partial<Pick<Invoice, "lineItems" | "subtotal" | "taxRate" | "taxAmount" | "total" | "notes" | "dueDate" | "status" | "currency" | "serviceType" | "discountAmount" | "discountDescription">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.update(invoices).set(data as any).where(eq(invoices.id, id));
}

export async function markInvoiceSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db
    .update(invoices)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(invoices.id, id));
}

export async function markInvoicePaid(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db
    .update(invoices)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(invoices.id, id));
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.delete(invoices).where(eq(invoices.id, id));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function calculateInvoiceTotals(
  lineItems: InvoiceLineItem[],
  taxRate: number,
  discountAmount?: number
): { subtotal: number; discountAmount: number; netAfterDiscount: number; taxAmount: number; total: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const discount = discountAmount ?? 0;
  const netAfterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(netAfterDiscount * (taxRate / 100) * 100) / 100;
  const total = Math.round((netAfterDiscount + taxAmount) * 100) / 100;
  return { subtotal, discountAmount: discount, netAfterDiscount, taxAmount, total };
}

// ── Service Types ─────────────────────────────────────────────────────────────

export async function getServiceTypes(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(serviceTypes)
    .where(eq(serviceTypes.trainerId, trainerId))
    .orderBy(serviceTypes.createdAt);
}

export async function createServiceType(trainerId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  // Prevent duplicates per trainer
  const existing = await db
    .select()
    .from(serviceTypes)
    .where(and(eq(serviceTypes.trainerId, trainerId), eq(serviceTypes.name, name)))
    .limit(1);
  if (existing.length > 0) throw new Error(`Service type "${name}" already exists`);
  const [result] = await db.insert(serviceTypes).values({ trainerId, name });
  const insertId = (result as any).insertId;
  return { id: insertId, name, trainerId, createdAt: new Date() };
}

export async function deleteServiceType(id: number, trainerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  // Check if used on any invoice
  const used = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.trainerId, trainerId)))
    .limit(1);
  // We check by name match — fetch the type first
  const [type] = await db
    .select()
    .from(serviceTypes)
    .where(and(eq(serviceTypes.id, id), eq(serviceTypes.trainerId, trainerId)))
    .limit(1);
  if (!type) throw new Error("Service type not found");
  const usedByInvoice = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.trainerId, trainerId), eq(invoices.serviceType as any, type.name)))
    .limit(1);
  if (usedByInvoice.length > 0) throw new Error("Cannot delete: this service type is used on existing invoices");
  await db.delete(serviceTypes).where(and(eq(serviceTypes.id, id), eq(serviceTypes.trainerId, trainerId)));
}
