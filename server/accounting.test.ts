/**
 * Accounting module tests
 * Tests the business logic layer: service types, business costs, and invoice discount logic.
 * Uses real DB trainer ID=1 (andy@andyknight.asia) for FK compliance.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  getServiceTypes,
  createServiceType,
  deleteServiceType,
  calculateInvoiceTotals,
} from "./invoiceDb";
import type { InvoiceLineItem } from "../drizzle/schema";
import {
  getCostsByMonth,
  addCost,
  updateCost,
  deleteCost,
  confirmMonth,
  getTotalCostsByMonth,
} from "./businessCostsDb";

// Real admin user ID (andy@andyknight.asia) — required for FK constraints
const TEST_TRAINER_ID = 1;

// ── Cleanup tracking ──────────────────────────────────────────────────────────

const createdServiceTypeIds: number[] = [];
const createdCostIds: number[] = [];

afterEach(async () => {
  for (const id of createdServiceTypeIds) {
    await deleteServiceType(id, TEST_TRAINER_ID).catch(() => {});
  }
  createdServiceTypeIds.length = 0;

  for (const id of createdCostIds) {
    await deleteCost(id, TEST_TRAINER_ID).catch(() => {});
  }
  createdCostIds.length = 0;
});

// ── Service types ─────────────────────────────────────────────────────────────

describe("service types", () => {
  it("returns an array from getServiceTypes", async () => {
    const result = await getServiceTypes(TEST_TRAINER_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds a new service type", async () => {
    const result = await createServiceType(TEST_TRAINER_ID, "Test Accounting Service Type");
    expect(result).toHaveProperty("id");
    expect(result.name).toBe("Test Accounting Service Type");
    createdServiceTypeIds.push(result.id);
  });

  it("new service type appears in list", async () => {
    const st = await createServiceType(TEST_TRAINER_ID, "Test Accounting Service List");
    createdServiceTypeIds.push(st.id);
    const list = await getServiceTypes(TEST_TRAINER_ID);
    const found = list.find((s) => s.id === st.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Test Accounting Service List");
  });

  it("deletes an unused service type", async () => {
    const st = await createServiceType(TEST_TRAINER_ID, "Test Accounting Service Delete");
    await deleteServiceType(st.id, TEST_TRAINER_ID);
    const list = await getServiceTypes(TEST_TRAINER_ID);
    const found = list.find((s) => s.id === st.id);
    expect(found).toBeUndefined();
  });

  it("prevents duplicate service type names for the same trainer", async () => {
    const st = await createServiceType(TEST_TRAINER_ID, "Test Accounting Dupe Check");
    createdServiceTypeIds.push(st.id);
    await expect(
      createServiceType(TEST_TRAINER_ID, "Test Accounting Dupe Check")
    ).rejects.toThrow();
  });
});

// ── Business costs ────────────────────────────────────────────────────────────

describe("business costs", () => {
  const TEST_MONTH = "2099-06"; // Far-future month to avoid collisions

  it("returns empty array for a month with no costs", async () => {
    const result = await getCostsByMonth(TEST_TRAINER_ID, TEST_MONTH);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("adds a cost and retrieves it", async () => {
    const added = await addCost({
      trainerId: TEST_TRAINER_ID,
      month: TEST_MONTH,
      category: "Rent",
      description: "Test rent cost",
      amount: 15000,
      isRecurring: false,
    });
    createdCostIds.push(added.id);
    const costs = await getCostsByMonth(TEST_TRAINER_ID, TEST_MONTH);
    const found = costs.find((c) => c.id === added.id);
    expect(found).toBeDefined();
    expect(parseFloat(String(found!.amount))).toBe(15000);
    expect(found!.category).toBe("Rent");
  });

  it("updates a cost amount", async () => {
    const added = await addCost({
      trainerId: TEST_TRAINER_ID,
      month: TEST_MONTH,
      category: "Equipment",
      description: "Test equipment cost",
      amount: 1000,
      isRecurring: false,
    });
    createdCostIds.push(added.id);
    await updateCost(added.id, TEST_TRAINER_ID, { amount: 1500 });
    const costs = await getCostsByMonth(TEST_TRAINER_ID, TEST_MONTH);
    const found = costs.find((c) => c.id === added.id);
    expect(parseFloat(String(found!.amount))).toBe(1500);
  });

  it("deletes a cost", async () => {
    const added = await addCost({
      trainerId: TEST_TRAINER_ID,
      month: TEST_MONTH,
      category: "Marketing",
      description: "Test marketing cost",
      amount: 800,
      isRecurring: false,
    });
    await deleteCost(added.id, TEST_TRAINER_ID);
    const costs = await getCostsByMonth(TEST_TRAINER_ID, TEST_MONTH);
    const found = costs.find((c) => c.id === added.id);
    expect(found).toBeUndefined();
  });

  it("total costs sums correctly", async () => {
    const a = await addCost({ trainerId: TEST_TRAINER_ID, month: TEST_MONTH, category: "Rent", description: "A", amount: 1000, isRecurring: false });
    const b = await addCost({ trainerId: TEST_TRAINER_ID, month: TEST_MONTH, category: "Insurance", description: "B", amount: 500, isRecurring: false });
    createdCostIds.push(a.id, b.id);
    const total = await getTotalCostsByMonth(TEST_TRAINER_ID, TEST_MONTH);
    expect(total).toBe(1500);
  });

  it("confirms a month without throwing", async () => {
    const uniqueMonth = "2099-07";
    await expect(confirmMonth(TEST_TRAINER_ID, uniqueMonth)).resolves.not.toThrow();
  });
});

// ── Invoice totals with discount ──────────────────────────────────────────────

describe("invoice totals with discount", () => {
  it("applies discount to reduce subtotal before tax", () => {
    const items: InvoiceLineItem[] = [
      { description: "PT Package", quantity: 10, unitPrice: 800, total: 8000 },
    ];
    const result = calculateInvoiceTotals(items, 0, 500);
    expect(result.subtotal).toBe(8000);
    expect(result.discountAmount).toBe(500);
    expect(result.netAfterDiscount).toBe(7500);
    expect(result.total).toBe(7500);
  });

  it("discount of zero leaves total unchanged", () => {
    const items: InvoiceLineItem[] = [
      { description: "Nutrition Consult", quantity: 1, unitPrice: 1200, total: 1200 },
    ];
    const result = calculateInvoiceTotals(items, 0, 0);
    expect(result.subtotal).toBe(1200);
    expect(result.discountAmount).toBe(0);
    expect(result.netAfterDiscount).toBe(1200);
    expect(result.total).toBe(1200);
  });

  it("tax is applied after discount", () => {
    const items: InvoiceLineItem[] = [
      { description: "Package", quantity: 1, unitPrice: 1000, total: 1000 },
    ];
    // HKD 100 discount → net 900 → 10% tax → 990
    const result = calculateInvoiceTotals(items, 10, 100);
    expect(result.netAfterDiscount).toBe(900);
    expect(result.taxAmount).toBe(90);
    expect(result.total).toBe(990);
  });

  it("discount cannot make total negative", () => {
    const items: InvoiceLineItem[] = [
      { description: "Item", quantity: 1, unitPrice: 100, total: 100 },
    ];
    const result = calculateInvoiceTotals(items, 0, 500);
    expect(result.netAfterDiscount).toBe(0);
    expect(result.total).toBe(0);
  });
});
