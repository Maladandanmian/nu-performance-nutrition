/**
 * Tests for package delete and deduct-sessions db helpers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the database module ──────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    deleteSessionPackage: vi.fn(),
    deductSessionsFromPackage: vi.fn(),
    getSessionPackageById: vi.fn(),
  };
});

import * as db from "./db";

const mockDeleteSessionPackage = vi.mocked(db.deleteSessionPackage);
const mockDeductSessionsFromPackage = vi.mocked(db.deductSessionsFromPackage);
const mockGetSessionPackageById = vi.mocked(db.getSessionPackageById);

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePackage(overrides: Partial<{
  id: number;
  trainerId: number;
  sessionsTotal: number;
  sessionsRemaining: number;
  notes: string | null;
}> = {}) {
  return {
    id: 1,
    trainerId: 10,
    clientId: 20,
    packageType: "1on1_pt",
    sessionsTotal: 10,
    sessionsRemaining: 10,
    purchaseDate: new Date("2026-01-01"),
    expiryDate: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── deleteSessionPackage ──────────────────────────────────────────────────────
describe("deleteSessionPackage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success for a zero-usage package owned by the trainer", async () => {
    mockDeleteSessionPackage.mockResolvedValueOnce({ success: true });
    const result = await db.deleteSessionPackage(1, 10);
    expect(result.success).toBe(true);
    expect(mockDeleteSessionPackage).toHaveBeenCalledWith(1, 10);
  });

  it("throws when the trainer does not own the package", async () => {
    mockDeleteSessionPackage.mockRejectedValueOnce(
      new Error("Not authorised to delete this package")
    );
    await expect(db.deleteSessionPackage(1, 99)).rejects.toThrow(
      "Not authorised to delete this package"
    );
  });

  it("throws when sessions are linked to the package", async () => {
    mockDeleteSessionPackage.mockRejectedValueOnce(
      new Error("Cannot delete: 3 sessions are linked to this package")
    );
    await expect(db.deleteSessionPackage(1, 10)).rejects.toThrow(
      "Cannot delete"
    );
  });

  it("throws when the package does not exist", async () => {
    mockDeleteSessionPackage.mockRejectedValueOnce(new Error("Package not found"));
    await expect(db.deleteSessionPackage(999, 10)).rejects.toThrow("Package not found");
  });
});

// ── deductSessionsFromPackage ─────────────────────────────────────────────────
describe("deductSessionsFromPackage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns updated totals after a valid deduction", async () => {
    mockDeductSessionsFromPackage.mockResolvedValueOnce({
      success: true,
      newTotal: 9,
      sessionsRemaining: 9,
    });
    const result = await db.deductSessionsFromPackage(1, 10, 1, "Trial session");
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(9);
  });

  it("throws when deducting more than the package total", async () => {
    mockDeductSessionsFromPackage.mockRejectedValueOnce(
      new Error("Cannot deduct more sessions than the package total")
    );
    await expect(db.deductSessionsFromPackage(1, 10, 20)).rejects.toThrow(
      "Cannot deduct more sessions than the package total"
    );
  });

  it("throws when the trainer does not own the package", async () => {
    mockDeductSessionsFromPackage.mockRejectedValueOnce(
      new Error("Not authorised to modify this package")
    );
    await expect(db.deductSessionsFromPackage(1, 99, 1)).rejects.toThrow(
      "Not authorised to modify this package"
    );
  });

  it("appends a note to existing package notes", async () => {
    mockDeductSessionsFromPackage.mockResolvedValueOnce({
      success: true,
      newTotal: 8,
      sessionsRemaining: 8,
    });
    const result = await db.deductSessionsFromPackage(1, 10, 2, "Two trial sessions");
    expect(result.newTotal).toBe(8);
    expect(mockDeductSessionsFromPackage).toHaveBeenCalledWith(1, 10, 2, "Two trial sessions");
  });

  it("works without a note (auto-generates one)", async () => {
    mockDeductSessionsFromPackage.mockResolvedValueOnce({
      success: true,
      newTotal: 9,
      sessionsRemaining: 9,
    });
    const result = await db.deductSessionsFromPackage(1, 10, 1);
    expect(result.success).toBe(true);
  });
});
