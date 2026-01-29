import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TEST_CLIENT_ID } from "./testSetup";
import * as db from "./db";

describe("Locked Quick Log Favorites", () => {
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

  it("should keep only one favorite per drink type (locked Quick Log)", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create first tea drink and mark as favorite
    const drink1 = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "English Breakfast Tea",
      volumeMl: 250,
      calories: 50,
      protein: 0,
      fat: 2,
      carbs: 5,
      fibre: 0,
      nutritionScore: 4,
      notes: "First tea",
    });

    await caller.drinks.toggleFavorite({
      drinkId: drink1.drinkId,
      clientId: testClientId,
      isFavorite: true,
    });

    // Create second tea drink and mark as favorite
    const drink2 = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "English Breakfast Tea",
      volumeMl: 300,
      calories: 60,
      protein: 0,
      fat: 2,
      carbs: 6,
      fibre: 0,
      nutritionScore: 4,
      notes: "Second tea",
    });

    await caller.drinks.toggleFavorite({
      drinkId: drink2.drinkId,
      clientId: testClientId,
      isFavorite: true,
    });

    // Get favorites - should only have ONE tea (the second one)
    const favorites = await db.getFavoriteDrinks(testClientId);
    const teaFavorites = favorites.filter(d => d.drinkType === "English Breakfast Tea");
    
    expect(teaFavorites.length).toBe(1);
    expect(teaFavorites[0].id).toBe(drink2.drinkId);
    expect(teaFavorites[0].notes).toBe("Second tea");
  });

  it("should not mark logged drinks as favorites (preserve locked Quick Log)", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create and favorite a drink
    const drink = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Coffee",
      volumeMl: 200,
      calories: 40,
      protein: 0,
      fat: 1,
      carbs: 4,
      fibre: 0,
      nutritionScore: 4,
      notes: "Original favorite",
    });

    await caller.drinks.toggleFavorite({
      drinkId: drink.drinkId,
      clientId: testClientId,
      isFavorite: true,
    });

    // Log the favorite drink via Quick Log
    const logResult = await caller.drinks.logFavorite({
      drinkId: drink.drinkId,
      clientId: testClientId,
    });

    // The logged drink should NOT be marked as favorite
    expect(logResult.drink).toBeDefined();
    expect(logResult.drink?.isFavorite).toBe(0);

    // Favorites list should still only have the original
    const favorites = await db.getFavoriteDrinks(testClientId);
    const coffeeFavorites = favorites.filter(d => d.drinkType === "Coffee");
    
    expect(coffeeFavorites.length).toBe(1);
    expect(coffeeFavorites[0].id).toBe(drink.drinkId);
    expect(coffeeFavorites[0].notes).toBe("Original favorite");
  });

  it("should allow up to 3 different drink types as favorites", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create and favorite 3 different drink types
    const tea = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Tea",
      volumeMl: 250,
      calories: 50,
      protein: 0,
      fat: 2,
      carbs: 5,
      fibre: 0,
      nutritionScore: 4,
    });

    const coffee = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Coffee",
      volumeMl: 200,
      calories: 40,
      protein: 0,
      fat: 1,
      carbs: 4,
      fibre: 0,
      nutritionScore: 4,
    });

    const water = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Water",
      volumeMl: 500,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      nutritionScore: 5,
    });

    await caller.drinks.toggleFavorite({ drinkId: tea.drinkId, clientId: testClientId, isFavorite: true });
    await caller.drinks.toggleFavorite({ drinkId: coffee.drinkId, clientId: testClientId, isFavorite: true });
    await caller.drinks.toggleFavorite({ drinkId: water.drinkId, clientId: testClientId, isFavorite: true });

    // Should have 3 different favorites
    const favorites = await db.getFavoriteDrinks(testClientId);
    expect(favorites.length).toBe(3);
    
    const types = favorites.map(d => d.drinkType).sort();
    expect(types).toEqual(["Coffee", "Tea", "Water"].sort());
  });

  it("should keep only one favorite per meal description (locked Quick Log)", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create first meal and mark as favorite
    const meal1 = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: "https://example.com/meal1.jpg",
      imageKey: "meal1-key",
      mealType: "breakfast",
      calories: 400,
      protein: 25,
      fat: 15,
      carbs: 45,
      fibre: 5,
      aiDescription: "Eggs and toast",
      aiConfidence: 0.9,
      notes: "First meal",
    });

    await caller.meals.toggleFavorite({
      mealId: meal1.mealId,
      clientId: testClientId,
      isFavorite: true,
    });

    // Create second meal with same description and mark as favorite
    const meal2 = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: "https://example.com/meal2.jpg",
      imageKey: "meal2-key",
      mealType: "breakfast",
      calories: 420,
      protein: 27,
      fat: 16,
      carbs: 46,
      fibre: 6,
      aiDescription: "Eggs and toast",
      aiConfidence: 0.85,
      notes: "Second meal",
    });

    await caller.meals.toggleFavorite({
      mealId: meal2.mealId,
      clientId: testClientId,
      isFavorite: true,
    });

    // Get favorites - should only have ONE "Eggs and toast" (the second one)
    const favorites = await db.getFavoriteMeals(testClientId);
    const eggsFavorites = favorites.filter(m => m.aiDescription === "Eggs and toast");
    
    expect(eggsFavorites.length).toBe(1);
    expect(eggsFavorites[0].id).toBe(meal2.mealId);
    expect(eggsFavorites[0].notes).toBe("Second meal");
  });
});
