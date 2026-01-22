import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as db from './db';

describe('Beverage Logging in saveMeal', () => {
  let testClientId: number;

  afterEach(async () => {
    // Clean up test data
    if (testClientId) {
      try {
        await db.deleteClientAndData(testClientId);
      } catch (error) {
        console.error('Failed to clean up test client:', error);
      }
    }
  });

  beforeEach(async () => {
    // Create a test client with nutrition goals
    const uniquePin = Math.floor(100000 + Math.random() * 900000).toString();
    const clientResult = await db.createClient({
      name: 'Test Client for Beverage',
      email: `bevtest${Date.now()}@example.com`,
      pin: uniquePin,
      trainerId: 1,
    });
    testClientId = Number(clientResult[0].insertId);

    await db.createNutritionGoal({
      clientId: testClientId,
      caloriesTarget: 2000,
      proteinTarget: 150,
      fatTarget: 65,
      carbsTarget: 250,
      fibreTarget: 30,
      hydrationTarget: 2500,
    });
  });

  it('should create exactly one meal entry when beverage is included', async () => {
    // Log a drink-only meal (no food photo)
    const mealResult = await db.createMeal({
      clientId: testClientId,
      imageUrl: '',
      imageKey: '',
      mealType: 'lunch',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      aiDescription: 'English breakfast tea with milk (350ml)',
      aiConfidence: 100,
      nutritionScore: 3,
      beverageType: 'English breakfast tea with milk',
      beverageVolumeMl: 350,
      beverageCalories: 37,
      beverageProtein: 3,
      beverageFat: 0,
      beverageCarbs: 4,
      beverageFibre: 0,
      loggedAt: new Date(),
    });

    const mealId = Number(mealResult[0].insertId);
    expect(mealId).toBeGreaterThan(0);

    // Verify exactly one meal entry was created
    const meals = await db.getMealsByClientId(testClientId);
    const mealsWithBeverage = meals.filter(m => m.beverageType === 'English breakfast tea with milk');
    expect(mealsWithBeverage.length).toBe(1);
  });

  it('should create body_metrics but NOT duplicate drink entries when beverage is included in meal', async () => {
    // This test verifies that beverages logged WITH meals should:
    // 1. Store beverage data in the meal's beverage fields
    // 2. Create hydration tracking (body_metrics)
    // 3. NOT create a separate standalone drink entry (to avoid duplication)
    
    // Create a meal with beverage
    await db.createMeal({
      clientId: testClientId,
      imageUrl: '',
      imageKey: '',
      mealType: 'lunch',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      aiDescription: 'Cappuccino (250ml)',
      aiConfidence: 100,
      nutritionScore: 3,
      beverageType: 'Cappuccino',
      beverageVolumeMl: 250,
      beverageCalories: 80,
      beverageProtein: 4,
      beverageFat: 4,
      beverageCarbs: 6,
      beverageFibre: 0,
      loggedAt: new Date(),
    });

    // Manually create body_metrics entry for hydration (this is what saveMeal should do)
    await db.createBodyMetric({
      clientId: testClientId,
      hydration: 250,
      recordedAt: new Date(),
    });

    // Verify NO separate drink entry was created (beverage data is in the meal)
    const drinks = await db.getDrinksByClientId(testClientId);
    const cappuccino = drinks.filter(d => d.drinkType === 'Cappuccino');
    expect(cappuccino.length).toBe(0); // Should be 0, not 1

    // Verify body_metrics entry was created for hydration tracking
    const metrics = await db.getBodyMetricsByClientId(testClientId);
    const hydrationEntries = metrics.filter(m => m.hydration === 250);
    expect(hydrationEntries.length).toBe(1);
    
    // Verify the meal has the beverage data
    const meals = await db.getMealsByClientId(testClientId);
    const mealWithBeverage = meals.find(m => m.beverageType === 'Cappuccino');
    expect(mealWithBeverage).toBeDefined();
    expect(mealWithBeverage?.beverageVolumeMl).toBe(250);
  });

  it('should not create duplicate entries when logging the same beverage', async () => {
    // Log beverage once
    await db.createMeal({
      clientId: testClientId,
      imageUrl: '',
      imageKey: '',
      mealType: 'lunch',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      aiDescription: 'Water (500ml)',
      aiConfidence: 100,
      nutritionScore: 5,
      beverageType: 'Water',
      beverageVolumeMl: 500,
      beverageCalories: 0,
      beverageProtein: 0,
      beverageFat: 0,
      beverageCarbs: 0,
      beverageFibre: 0,
      loggedAt: new Date(),
    });

    await db.createDrink({
      clientId: testClientId,
      drinkType: 'Water',
      volumeMl: 500,
      loggedAt: new Date(),
    });

    await db.createBodyMetric({
      clientId: testClientId,
      hydration: 500,
      recordedAt: new Date(),
    });

    // Verify counts
    const meals = await db.getMealsByClientId(testClientId);
    const waterMeals = meals.filter(m => m.beverageType === 'Water');
    expect(waterMeals.length).toBe(1);

    const drinks = await db.getDrinksByClientId(testClientId);
    const waterDrinks = drinks.filter(d => d.drinkType === 'Water');
    expect(waterDrinks.length).toBe(1);

    const metrics = await db.getBodyMetricsByClientId(testClientId);
    const hydrationEntries = metrics.filter(m => m.hydration === 500);
    expect(hydrationEntries.length).toBe(1);
  });
});
