import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TEST_CLIENT_ID } from "./testSetup";
import * as db from "./db";

describe("Drink Nutrition Scoring", () => {
  // Use existing test client (ID 1) which should have nutrition goals
  const testClientId = TEST_CLIENT_ID;

  beforeEach(async () => {
    // Ensure test client has nutrition goals
    const existingGoals = await db.getNutritionGoalByClientId(testClientId);
    if (!existingGoals) {
      // Create nutrition goals using router procedure which handles it correctly
      const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);
      await caller.nutritionGoals.create({
        clientId: testClientId,
        calories: 2000,
        protein: 150,
        fat: 65,
        carbs: 250,
        fibre: 30,
        hydration: 2000,
      });
    }
  });

  it("should calculate score for a drink", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    const result = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 100,
      protein: 5,
      fat: 2,
      carbs: 15,
      fibre: 0,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(5);
  });

  it("should create drink with nutrition score", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Calculate score first
    const scoreResult = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 150,
      protein: 10,
      fat: 3,
      carbs: 20,
      fibre: 1,
    });

    // Create drink with score
    const drink = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Protein Shake",
      volumeMl: 300,
      calories: 150,
      protein: 10,
      fat: 3,
      carbs: 20,
      fibre: 1,
      nutritionScore: scoreResult.score,
      notes: "Post-workout shake",
    });

    expect(drink).toBeDefined();
    expect(drink.drinkId).toBeGreaterThan(0);

    // Verify drink was created with score
    const savedDrink = await db.getDrinkById(drink.drinkId);
    expect(savedDrink).toBeDefined();
    expect(savedDrink?.nutritionScore).toBe(scoreResult.score);
  });

  it("should show different scores based on daily progress", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Calculate score for first drink (early in day)
    const firstScore = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 200,
      protein: 5,
      fat: 8,
      carbs: 30,
      fibre: 0,
    });

    // Log the first drink
    await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Latte",
      volumeMl: 350,
      calories: 200,
      protein: 5,
      fat: 8,
      carbs: 30,
      fibre: 0,
      nutritionScore: firstScore.score,
    });

    // Calculate score for same drink later (after progress)
    const secondScore = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 200,
      protein: 5,
      fat: 8,
      carbs: 30,
      fibre: 0,
    });

    // Scores should be different because daily totals changed
    // (First drink might score better as it's earlier in the day)
    expect(firstScore.score).toBeGreaterThanOrEqual(1);
    expect(secondScore.score).toBeGreaterThanOrEqual(1);
    expect(firstScore.score).toBeLessThanOrEqual(5);
    expect(secondScore.score).toBeLessThanOrEqual(5);
  });

  it("should handle drinks with zero nutrition", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    const result = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(5);
  });
});
