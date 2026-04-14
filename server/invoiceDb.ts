import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc } from "drizzle-orm";
import { invoices, Invoice, InsertInvoice, InvoiceLineItem } from "../drizzle/schema";

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
  data: Partial<Pick<Invoice, "lineItems" | "subtotal" | "taxRate" | "taxAmount" | "total" | "notes" | "dueDate" | "status" | "currency">>
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
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, total };
}
