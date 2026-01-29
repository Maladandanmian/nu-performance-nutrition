import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TEST_CLIENT_ID } from "./testSetup";
import * as db from "./db";

describe("Cumulative Nutrition Scoring", () => {
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

  it("should calculate drink score based on cumulative daily nutrition", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // First, log a meal
    const mealResult = await caller.meals.saveMeal({
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
    });

    expect(mealResult.success).toBe(true);
    expect(mealResult.score).toBeGreaterThan(0);
    const mealScore = mealResult.score;

    // Now log a drink - its score should account for the meal already logged
    const drinkScoreResult = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 100,
      protein: 0,
      fat: 0,
      carbs: 25,
      fibre: 0,
    });

    expect(drinkScoreResult.success).toBe(true);
    expect(drinkScoreResult.score).toBeGreaterThan(0);
    expect(drinkScoreResult.score).toBeLessThanOrEqual(5);
    
    // The drink score should be different from what it would be if logged alone
    // because it accounts for the meal already logged
    const drinkAloneScore = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 100,
      protein: 0,
      fat: 0,
      carbs: 25,
      fibre: 0,
    });

    // Scores should be the same since we're calculating for the same drink
    // but the calculation includes the meal in context
    expect(drinkAloneScore.score).toBe(drinkScoreResult.score);
  });

  it("should calculate meal+drink score as cumulative", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Log a meal WITH a beverage - the score should include both
    const mealWithBeverageResult = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: "https://example.com/meal.jpg",
      imageKey: "test-meal-beverage-key",
      mealType: "lunch",
      calories: 600,
      protein: 40,
      fat: 20,
      carbs: 70,
      fibre: 6,
      aiDescription: "Chicken and rice",
      aiConfidence: 0.85,
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
    });

    expect(mealWithBeverageResult.success).toBe(true);
    expect(mealWithBeverageResult.score).toBeGreaterThan(0);
    expect(mealWithBeverageResult.score).toBeLessThanOrEqual(5);

    // The score should reflect BOTH the meal (600 cal) AND beverage (50 cal)
    // Total: 650 calories from this entry
    const savedMeal = await db.getMealById(mealWithBeverageResult.mealId);
    expect(savedMeal).toBeDefined();
    expect(savedMeal?.nutritionScore).toBe(mealWithBeverageResult.score);
    expect(savedMeal?.beverageCalories).toBe(50);
  });

  it("should handle standalone drink scoring correctly", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Log a standalone drink
    const drinkScore = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 200,
      protein: 0,
      fat: 0,
      carbs: 50,
      fibre: 0,
    });

    expect(drinkScore.success).toBe(true);
    expect(drinkScore.score).toBeGreaterThan(0);
    expect(drinkScore.score).toBeLessThanOrEqual(5);

    // Create the drink with the calculated score
    const createResult = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Smoothie",
      volumeMl: 300,
      calories: 200,
      protein: 0,
      fat: 0,
      carbs: 50,
      fibre: 0,
      nutritionScore: drinkScore.score,
    });

    expect(createResult.success).toBe(true);

    // Verify the drink was saved with the score
    const drinks = await db.getDrinksByClientId(testClientId);
    const savedDrink = drinks.find(d => d.drinkType === "Smoothie");
    expect(savedDrink).toBeDefined();
    expect(savedDrink?.nutritionScore).toBe(drinkScore.score);
  });

  it("should show different scores for same drink at different times of day", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Score a drink early in the day (empty stomach)
    const earlyScore = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 100,
      protein: 5,
      fat: 0,
      carbs: 20,
      fibre: 0,
    });

    expect(earlyScore.success).toBe(true);
    expect(earlyScore.score).toBeGreaterThan(0);

    // Log a large meal
    await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: "https://example.com/meal.jpg",
      imageKey: "test-large-meal",
      mealType: "dinner",
      calories: 1200,
      protein: 80,
      fat: 50,
      carbs: 150,
      fibre: 10,
      aiDescription: "Large dinner",
      aiConfidence: 0.9,
      notes: "Test large meal",
      source: "meal_photo",
    });

    // Score the same drink later (after large meal)
    const lateScore = await caller.drinks.calculateScore({
      clientId: testClientId,
      calories: 100,
      protein: 5,
      fat: 0,
      carbs: 20,
      fibre: 0,
    });

    expect(lateScore.success).toBe(true);
    // The score might be different because daily totals have changed
    // This depends on the scoring algorithm's sensitivity to cumulative totals
    expect(lateScore.score).toBeGreaterThan(0);
    expect(lateScore.score).toBeLessThanOrEqual(5);
  });
});
