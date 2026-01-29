import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Visual Star Indicators for Logged Favorites", () => {
  const testClientId = 1;

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

  it("should set sourceType='favorite' when logging a favorite drink", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create and favorite a drink
    const drink = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Green Tea",
      volumeMl: 250,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      nutritionScore: 5,
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

    // The logged drink should have sourceType='favorite'
    expect(logResult.drink).toBeDefined();
    expect(logResult.drink?.sourceType).toBe("favorite");
    expect(logResult.drink?.isFavorite).toBe(0); // Not marked as favorite in database
  });

  it("should set sourceType='repeat' when using Repeat Last", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create a drink
    await caller.drinks.create({
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

    // Repeat the last drink
    const repeatResult = await caller.drinks.repeatLast({
      clientId: testClientId,
    });

    // The repeated drink should have sourceType='repeat'
    expect(repeatResult.drink).toBeDefined();
    expect(repeatResult.drink?.sourceType).toBe("repeat");
    expect(repeatResult.drink?.isFavorite).toBe(0); // Not marked as favorite
  });

  it("should show star for drinks with sourceType='favorite' even if isFavorite=0", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create and favorite a drink
    const drink = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Coffee",
      volumeMl: 200,
      calories: 5,
      protein: 0,
      fat: 0,
      carbs: 1,
      fibre: 0,
      nutritionScore: 4,
    });

    await caller.drinks.toggleFavorite({
      drinkId: drink.drinkId,
      clientId: testClientId,
      isFavorite: true,
    });

    // Log the favorite drink
    const logResult = await caller.drinks.logFavorite({
      drinkId: drink.drinkId,
      clientId: testClientId,
    });

    // Get all drinks for this client
    const allDrinks = await caller.drinks.list({ clientId: testClientId });

    // Find the logged drink
    const loggedDrink = allDrinks.find(d => d.id === logResult.drink?.id);
    
    // Verify it should show a star (sourceType='favorite' even though isFavorite=0)
    expect(loggedDrink).toBeDefined();
    expect(loggedDrink?.sourceType).toBe("favorite");
    expect(loggedDrink?.isFavorite).toBe(0);
    
    // In the UI, this drink should show a filled star because:
    // drink.isFavorite || drink.sourceType === 'favorite' || drink.sourceType === 'repeat'
    const shouldShowStar = loggedDrink!.isFavorite === 1 || 
                          loggedDrink!.sourceType === 'favorite' || 
                          loggedDrink!.sourceType === 'repeat';
    expect(shouldShowStar).toBe(true);
  });

  it("should allow toggling favorite on any drink entry (logged or original)", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as any);

    // Create a drink manually
    const drink = await caller.drinks.create({
      clientId: testClientId,
      drinkType: "Herbal Tea",
      volumeMl: 300,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      nutritionScore: 5,
    });

    // Initially not a favorite
    let drinkData = await db.getDrinkById(drink.drinkId);
    expect(drinkData?.isFavorite).toBe(0);

    // Toggle to favorite
    await caller.drinks.toggleFavorite({
      drinkId: drink.drinkId,
      clientId: testClientId,
      isFavorite: true,
    });

    drinkData = await db.getDrinkById(drink.drinkId);
    expect(drinkData?.isFavorite).toBe(1);

    // Log it via Quick Log
    const logResult = await caller.drinks.logFavorite({
      drinkId: drink.drinkId,
      clientId: testClientId,
    });

    // The logged drink should have sourceType='favorite' but isFavorite=0
    expect(logResult.drink?.sourceType).toBe("favorite");
    expect(logResult.drink?.isFavorite).toBe(0);

    // Now toggle the logged drink to favorite (user clicks star on logged entry)
    await caller.drinks.toggleFavorite({
      drinkId: logResult.drink!.id,
      clientId: testClientId,
      isFavorite: true,
    });

    // The logged drink should now be marked as favorite
    const loggedDrinkData = await db.getDrinkById(logResult.drink!.id);
    expect(loggedDrinkData?.isFavorite).toBe(1);

    // The original favorite should be un-favorited (locked Quick Log)
    const originalDrinkData = await db.getDrinkById(drink.drinkId);
    expect(originalDrinkData?.isFavorite).toBe(0);
  });
});
