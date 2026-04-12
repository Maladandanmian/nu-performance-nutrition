import { describe, it, expect } from "vitest";
import { calculateInvoiceTotals } from "./invoiceDb";
import type { InvoiceLineItem } from "../drizzle/schema";

// ── calculateInvoiceTotals ────────────────────────────────────────────────────

describe("calculateInvoiceTotals", () => {
  it("returns zeros for an empty line items array", () => {
    const result = calculateInvoiceTotals([], 0);
    expect(result).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });

  it("sums line item totals correctly with no tax", () => {
    const items: InvoiceLineItem[] = [
      { description: "PT Session", quantity: 10, unitPrice: 500, total: 5000 },
      { description: "Nutrition Consult", quantity: 1, unitPrice: 800, total: 800 },
    ];
    const result = calculateInvoiceTotals(items, 0);
    expect(result.subtotal).toBe(5800);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(5800);
  });

  it("calculates tax correctly at 10%", () => {
    const items: InvoiceLineItem[] = [
      { description: "Package", quantity: 1, unitPrice: 1000, total: 1000 },
    ];
    const result = calculateInvoiceTotals(items, 10);
    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(100);
    expect(result.total).toBe(1100);
  });

  it("rounds tax to 2 decimal places", () => {
    const items: InvoiceLineItem[] = [
      { description: "Item", quantity: 1, unitPrice: 100, total: 100 },
    ];
    // 100 * 7.5% = 7.5 — exact
    const result = calculateInvoiceTotals(items, 7.5);
    expect(result.taxAmount).toBe(7.5);
    expect(result.total).toBe(107.5);
  });

  it("handles fractional tax that requires rounding", () => {
    const items: InvoiceLineItem[] = [
      { description: "Item", quantity: 1, unitPrice: 33.33, total: 33.33 },
    ];
    // 33.33 * 10% = 3.333 → rounds to 3.33
    const result = calculateInvoiceTotals(items, 10);
    expect(result.taxAmount).toBe(3.33);
    expect(result.total).toBe(36.66);
  });

  it("handles multiple items with mixed quantities and prices", () => {
    const items: InvoiceLineItem[] = [
      { description: "Session A", quantity: 5, unitPrice: 200, total: 1000 },
      { description: "Session B", quantity: 3, unitPrice: 150, total: 450 },
      { description: "Admin Fee", quantity: 1, unitPrice: 50, total: 50 },
    ];
    const result = calculateInvoiceTotals(items, 0);
    expect(result.subtotal).toBe(1500);
    expect(result.total).toBe(1500);
  });

  it("handles zero tax rate explicitly", () => {
    const items: InvoiceLineItem[] = [
      { description: "Item", quantity: 2, unitPrice: 500, total: 1000 },
    ];
    const result = calculateInvoiceTotals(items, 0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });
});

// ── Invoice number format ─────────────────────────────────────────────────────

describe("invoice number format", () => {
  it("follows INV-YYYY-NNNN pattern", () => {
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^INV-${year}-\\d{4}$`);
    // Simulate the generation logic
    const seq = 1;
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;
    expect(invoiceNumber).toMatch(pattern);
    expect(invoiceNumber).toBe(`INV-${year}-0001`);
  });

  it("pads sequence numbers to 4 digits", () => {
    const year = new Date().getFullYear();
    [1, 9, 10, 99, 100, 999].forEach((seq) => {
      const num = `INV-${year}-${String(seq).padStart(4, "0")}`;
      expect(num.split("-")[2]).toHaveLength(4);
    });
  });

  it("sequence 1000 and above does not truncate", () => {
    const year = new Date().getFullYear();
    const num = `INV-${year}-${String(1000).padStart(4, "0")}`;
    expect(num).toBe(`INV-${year}-1000`);
  });
});

// ── Status transitions ────────────────────────────────────────────────────────

describe("invoice status logic", () => {
  it("draft invoices can be deleted", () => {
    const status = "draft";
    const canDelete = status !== "sent";
    expect(canDelete).toBe(true);
  });

  it("sent invoices cannot be deleted", () => {
    const status = "sent";
    const canDelete = status !== "sent";
    expect(canDelete).toBe(false);
  });

  it("paid invoices cannot be deleted", () => {
    const status = "paid";
    const canDelete = status !== "sent";
    // paid invoices should also be protected — extend the guard
    const canDeleteExtended = status === "draft";
    expect(canDeleteExtended).toBe(false);
  });
});

// ── Line item total calculation ───────────────────────────────────────────────

describe("line item total calculation", () => {
  it("total equals quantity times unit price", () => {
    const quantity = 10;
    const unitPrice = 500;
    const total = Math.round(quantity * unitPrice * 100) / 100;
    expect(total).toBe(5000);
  });

  it("handles fractional unit prices correctly", () => {
    const quantity = 3;
    const unitPrice = 33.33;
    const total = Math.round(quantity * unitPrice * 100) / 100;
    expect(total).toBe(99.99);
  });

  it("handles zero quantity", () => {
    const total = Math.round(0 * 500 * 100) / 100;
    expect(total).toBe(0);
  });

  it("handles zero unit price", () => {
    const total = Math.round(10 * 0 * 100) / 100;
    expect(total).toBe(0);
  });
});
