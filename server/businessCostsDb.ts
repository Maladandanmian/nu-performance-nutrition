import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, asc } from "drizzle-orm";
import { businessCosts } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[BusinessCostsDb] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Default cost templates seeded for each new month
export const DEFAULT_COST_TEMPLATES = [
  { category: "Rent" as const, description: "Monthly rent", amount: 0, isRecurring: true },
  { category: "Software Subscriptions" as const, description: "Software subscriptions", amount: 0, isRecurring: true },
  { category: "Insurance" as const, description: "Insurance", amount: 0, isRecurring: true },
  { category: "Equipment" as const, description: "Equipment", amount: 0, isRecurring: false },
  { category: "Marketing" as const, description: "Marketing", amount: 0, isRecurring: false },
];

export type CostCategory = "Rent" | "Software Subscriptions" | "Insurance" | "Equipment" | "Marketing" | "Other";

export interface BusinessCostRow {
  id: number;
  trainerId: number;
  category: CostCategory;
  description: string;
  amount: string;
  isRecurring: boolean;
  month: string; // YYYY-MM
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all costs for a trainer in a given month (YYYY-MM)
 */
export async function getCostsByMonth(trainerId: number, month: string): Promise<BusinessCostRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(businessCosts)
    .where(and(eq(businessCosts.trainerId, trainerId), eq(businessCosts.month, month)))
    .orderBy(asc(businessCosts.category), asc(businessCosts.createdAt)) as any;
}

/**
 * Seed a new month with templates from the previous month's recurring costs.
 * If no previous month exists, use DEFAULT_COST_TEMPLATES.
 * Returns the seeded rows.
 */
export async function seedMonthFromPrevious(trainerId: number, month: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Check if month already seeded
  const existing = await getCostsByMonth(trainerId, month);
  if (existing.length > 0) return; // Already seeded

  // Find previous month
  const [year, m] = month.split("-").map(Number);
  const prevDate = new Date(year, m - 2, 1); // m-2 because months are 0-indexed
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const prevCosts = await getCostsByMonth(trainerId, prevMonth);

  let templates: Array<{ category: CostCategory; description: string; amount: number; isRecurring: boolean }>;

  if (prevCosts.length > 0) {
    // Use recurring costs from previous month as templates
    templates = prevCosts
      .filter((c) => c.isRecurring)
      .map((c) => ({
        category: c.category,
        description: c.description,
        amount: parseFloat(String(c.amount)),
        isRecurring: true,
      }));
    // Add non-recurring defaults with 0 amount
    const recurringCategories = new Set(templates.map((t) => t.category));
    for (const def of DEFAULT_COST_TEMPLATES) {
      if (!recurringCategories.has(def.category)) {
        templates.push({ ...def, amount: 0 });
      }
    }
  } else {
    templates = DEFAULT_COST_TEMPLATES.map((t) => ({ ...t }));
  }

  // Insert all templates for the new month
  for (const t of templates) {
    await db.insert(businessCosts).values({
      trainerId,
      category: t.category,
      description: t.description,
      amount: String(t.amount) as any,
      isRecurring: t.isRecurring,
      month,
      confirmedAt: null,
    });
  }
}

/**
 * Add a new cost entry for a specific month
 */
export async function addCost(data: {
  trainerId: number;
  category: CostCategory;
  description: string;
  amount: number;
  isRecurring: boolean;
  month: string;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const [result] = await db.insert(businessCosts).values({
    trainerId: data.trainerId,
    category: data.category,
    description: data.description,
    amount: String(data.amount) as any,
    isRecurring: data.isRecurring,
    month: data.month,
    confirmedAt: null,
  });
  return { id: (result as any).insertId };
}

/**
 * Update an existing cost entry
 */
export async function updateCost(
  id: number,
  trainerId: number,
  data: { amount?: number; description?: string; isRecurring?: boolean; confirmedAt?: Date | null }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const updates: any = {};
  if (data.amount !== undefined) updates.amount = String(data.amount);
  if (data.description !== undefined) updates.description = data.description;
  if (data.isRecurring !== undefined) updates.isRecurring = data.isRecurring;
  if (data.confirmedAt !== undefined) updates.confirmedAt = data.confirmedAt;
  await db
    .update(businessCosts)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(businessCosts.id, id), eq(businessCosts.trainerId, trainerId)));
}

/**
 * Delete a cost entry
 */
export async function deleteCost(id: number, trainerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db
    .delete(businessCosts)
    .where(and(eq(businessCosts.id, id), eq(businessCosts.trainerId, trainerId)));
}

/**
 * Mark all costs for a month as confirmed
 */
export async function confirmMonth(trainerId: number, month: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db
    .update(businessCosts)
    .set({ confirmedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(businessCosts.trainerId, trainerId), eq(businessCosts.month, month)));
}

/**
 * Get total costs for a month
 */
export async function getTotalCostsByMonth(trainerId: number, month: string): Promise<number> {
  const costs = await getCostsByMonth(trainerId, month);
  return costs.reduce((sum, c) => sum + parseFloat(String(c.amount)), 0);
}
