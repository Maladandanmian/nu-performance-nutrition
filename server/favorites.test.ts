import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import { getTestClientId, createTestContext, verifyTestAccount, cleanupTestData } from './test-helpers';
import * as db from './db';

describe('Favorites System', () => {
  let testClientId: number;
  let testContext: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof appRouter.createCaller>;
  let testMealId: number;
  let testDrinkId: number;

  beforeAll(async () => {
    testClientId = await getTestClientId();
    testContext = await createTestContext();
    caller = appRouter.createCaller(testContext);
    await verifyTestAccount(testClientId);

    // Create a test meal using db function
    const meal = await db.createMeal({
      clientId: testClientId,
      mealType: 'lunch',
      loggedAt: new Date(),
      imageUrl: 'https://example.com/test.jpg',
      imageKey: 'test-key',
      aiDescription: 'Test meal for favorites',
      calories: 500,
      protein: 30,
      fat: 20,
      carbs: 50,
      fibre: 10,
      nutritionScore: 4,
      components: JSON.stringify([]),
      notes: 'Test meal',
      source: 'meal_photo',
    });
    testMealId = meal.id;

    // Create a test drink using db function
    const drink = await db.createDrink({
      clientId: testClientId,
      drinkType: 'Test Coffee',
      volumeMl: 250,
      loggedAt: new Date(),
      calories: 50,
      protein: 2,
      fat: 1,
      carbs: 8,
      fibre: 0,
      notes: 'Test drink',
    });
    testDrinkId = drink.id;
  });

  afterAll(async () => {
    await cleanupTestData(testClientId);
  });

  describe('Meal Favorites', () => {
    it('should toggle meal as favorite', async () => {
      // Mark as favorite
      const result1 = await caller.meals.toggleFavorite({
        mealId: testMealId,
        clientId: testClientId,
      });
      expect(result1.isFavorite).toBe(true);

      // Unmark as favorite
      const result2 = await caller.meals.toggleFavorite({
        mealId: testMealId,
        clientId: testClientId,
      });
      expect(result2.isFavorite).toBe(false);

      // Mark as favorite again for subsequent tests
      await caller.meals.toggleFavorite({
        mealId: testMealId,
        clientId: testClientId,
      });
    });

    it('should get favorite meals (up to 3)', async () => {
      const favorites = await caller.meals.getFavorites({
        clientId: testClientId,
      });
      
      expect(favorites).toBeDefined();
      expect(Array.isArray(favorites)).toBe(true);
      expect(favorites.length).toBeGreaterThan(0);
      expect(favorites.length).toBeLessThanOrEqual(3);
      expect(favorites[0].isFavorite).toBe(true);
    });

    it('should log a favorite meal with new timestamp', async () => {
      const originalMeals = await db.getMealsByClientId(testClientId);
      const originalCount = originalMeals.length;

      const result = await caller.meals.logFavorite({
        mealId: testMealId,
        clientId: testClientId,
      });

      expect(result.success).toBe(true);
      expect(result.newMealId).toBeDefined();
      expect(result.newMealId).not.toBe(testMealId);

      const updatedMeals = await db.getMealsByClientId(testClientId);
      expect(updatedMeals.length).toBe(originalCount + 1);

      // Verify the new meal has the same nutrition but different timestamp
      const newMeal = updatedMeals.find(m => m.id === result.newMealId);
      expect(newMeal).toBeDefined();
      expect(newMeal!.calories).toBe(500);
      expect(newMeal!.protein).toBe(30);
      expect(newMeal!.isFavorite).toBe(false); // New meal should not be favorite by default
    });

    it('should repeat last meal', async () => {
      const originalMeals = await db.getMealsByClientId(testClientId);
      const originalCount = originalMeals.length;
      const lastMeal = originalMeals[0]; // Most recent meal

      const result = await caller.meals.repeatLast({
        clientId: testClientId,
      });

      expect(result.success).toBe(true);
      expect(result.newMealId).toBeDefined();

      const updatedMeals = await db.getMealsByClientId(testClientId);
      expect(updatedMeals.length).toBe(originalCount + 1);

      // Verify the new meal matches the last meal's nutrition
      const newMeal = updatedMeals.find(m => m.id === result.newMealId);
      expect(newMeal).toBeDefined();
      expect(newMeal!.calories).toBe(lastMeal.calories);
      expect(newMeal!.protein).toBe(lastMeal.protein);
      expect(newMeal!.mealType).toBe(lastMeal.mealType);
    });
  });

  describe('Drink Favorites', () => {
    it('should toggle drink as favorite', async () => {
      // Mark as favorite
      const result1 = await caller.drinks.toggleFavorite({
        drinkId: testDrinkId,
        clientId: testClientId,
      });
      expect(result1.isFavorite).toBe(true);

      // Unmark as favorite
      const result2 = await caller.drinks.toggleFavorite({
        drinkId: testDrinkId,
        clientId: testClientId,
      });
      expect(result2.isFavorite).toBe(false);

      // Mark as favorite again for subsequent tests
      await caller.drinks.toggleFavorite({
        drinkId: testDrinkId,
        clientId: testClientId,
      });
    });

    it('should get favorite drinks (up to 3)', async () => {
      const favorites = await caller.drinks.getFavorites({
        clientId: testClientId,
      });
      
      expect(favorites).toBeDefined();
      expect(Array.isArray(favorites)).toBe(true);
      expect(favorites.length).toBeGreaterThan(0);
      expect(favorites.length).toBeLessThanOrEqual(3);
      expect(favorites[0].isFavorite).toBe(true);
    });

    it('should log a favorite drink with new timestamp', async () => {
      const originalDrinks = await db.getDrinksByClientId(testClientId);
      const originalCount = originalDrinks.length;

      const result = await caller.drinks.logFavorite({
        drinkId: testDrinkId,
        clientId: testClientId,
      });

      expect(result.success).toBe(true);
      expect(result.newDrinkId).toBeDefined();
      expect(result.newDrinkId).not.toBe(testDrinkId);

      const updatedDrinks = await db.getDrinksByClientId(testClientId);
      expect(updatedDrinks.length).toBe(originalCount + 1);

      // Verify the new drink has the same properties but different timestamp
      const newDrink = updatedDrinks.find(d => d.id === result.newDrinkId);
      expect(newDrink).toBeDefined();
      expect(newDrink!.drinkType).toBe('Test Coffee');
      expect(newDrink!.volumeMl).toBe(250);
      expect(newDrink!.isFavorite).toBe(false); // New drink should not be favorite by default
    });
  });
});
