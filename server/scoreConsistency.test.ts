import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TEST_CLIENT_ID } from "./testSetup";
import * as db from "./db";

describe("Meal Score Consistency", () => {
  const testClientId = TEST_CLIENT_ID;

  beforeEach(async () => {
    // Ensure test client has nutrition goals
    const existingGoals = await db.getNutritionGoalByClientId(testClientId);
    if (!existingGoals) {
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

  it("should use preCalculatedScore when provided to saveMeal", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Simulate the flow: first analyze (gets a score), then save with that score
    const preCalculatedScore = 4; // Score shown in preview

    // Save meal with pre-calculated score
    const saveResult = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: "https://example.com/meal.jpg",
      imageKey: "test-meal-key",
      mealType: "breakfast",
      calories: 500,
      protein: 30,
      fat: 15,
      carbs: 60,
      fibre: 5,
      aiDescription: "Eggs and toast",
      aiConfidence: 0.9,
      notes: "Test meal",
      source: "meal_photo",
      preCalculatedScore, // Pass the pre-calculated score
    });

    expect(saveResult.success).toBe(true);
    // The saved score should match the pre-calculated score
    expect(saveResult.score).toBe(preCalculatedScore);

    // Verify in database
    const savedMeal = await db.getMealById(saveResult.mealId);
    expect(savedMeal?.nutritionScore).toBe(preCalculatedScore);
  });

  it("should recalculate score if preCalculatedScore not provided (backward compatibility)", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Save meal WITHOUT pre-calculated score (old behavior)
    const saveResult = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: "https://example.com/meal.jpg",
      imageKey: "test-meal-key-2",
      mealType: "lunch",
      calories: 600,
      protein: 40,
      fat: 20,
      carbs: 70,
      fibre: 6,
      aiDescription: "Chicken and rice",
      aiConfidence: 0.85,
      notes: "Test meal",
      source: "meal_photo",
      // No preCalculatedScore provided
    });

    expect(saveResult.success).toBe(true);
    expect(saveResult.score).toBeGreaterThan(0);
    expect(saveResult.score).toBeLessThanOrEqual(5);

    // Verify in database
    const savedMeal = await db.getMealById(saveResult.mealId);
    expect(savedMeal?.nutritionScore).toBe(saveResult.score);
  });

  it("should maintain score consistency with beverages", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    const preCalculatedScore = 3;

    // Save meal WITH beverage and pre-calculated score
    const saveResult = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: "https://example.com/meal.jpg",
      imageKey: "test-meal-beverage-key",
      mealType: "dinner",
      calories: 600,
      protein: 40,
      fat: 20,
      carbs: 70,
      fibre: 6,
      aiDescription: "Salmon and vegetables",
      aiConfidence: 0.9,
      notes: "With coffee",
      // Beverage data
      beverageType: "Coffee with milk",
      beverageVolumeMl: 250,
      beverageCalories: 50,
      beverageProtein: 2,
      beverageFat: 2,
      beverageCarbs: 5,
      beverageFibre: 0,
      beverageCategory: "hot_beverage",
      source: "meal_photo",
      preCalculatedScore, // Score includes both meal and beverage
    });

    expect(saveResult.success).toBe(true);
    expect(saveResult.score).toBe(preCalculatedScore);

    // Verify the score reflects both meal and beverage
    const savedMeal = await db.getMealById(saveResult.mealId);
    expect(savedMeal?.nutritionScore).toBe(preCalculatedScore);
    expect(savedMeal?.beverageCalories).toBe(50);
  });
});
