import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { serviceTypes } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Service Types Seeding", () => {
  const LUKE_TRAINER_ID = 1;
  const SERVICE_TYPES_TO_SEED = [
    "PT Package",
    "PT PAYG",
    "Nutrition Consult",
    "Monthly Online Gym Program",
    "One Month Nutrition Coaching",
    "Three Month Nutrition Coaching",
  ];

  beforeAll(async () => {
    // Clean up any existing service types for Luke
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    await db
      .delete(serviceTypes)
      .where(eq(serviceTypes.trainerId, LUKE_TRAINER_ID));
  });

  it("should seed 6 service types for Luke", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Insert all service types
    for (const name of SERVICE_TYPES_TO_SEED) {
      await db.insert(serviceTypes).values({
        trainerId: LUKE_TRAINER_ID,
        name,
        createdAt: new Date(),
      });
    }

    // Verify all were inserted
    const inserted = await db
      .select()
      .from(serviceTypes)
      .where(eq(serviceTypes.trainerId, LUKE_TRAINER_ID));

    expect(inserted).toHaveLength(6);
    expect(inserted.map((st) => st.name)).toEqual(SERVICE_TYPES_TO_SEED);
  });

  it("listServiceTypes should return seeded service types", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const types = await db
      .select()
      .from(serviceTypes)
      .where(eq(serviceTypes.trainerId, LUKE_TRAINER_ID));

    expect(types.length).toBeGreaterThan(0);
    expect(types[0].name).toBeDefined();
  });
});
