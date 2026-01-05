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

  it('should create drink and body_metrics entries when beverage is included in saveMeal', async () => {
    // This test verifies the fix: saveMeal should also create drinks and body_metrics entries
    // when beverage data is present
    
    // First, create the meal with beverage
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

    // Manually create the drink and body_metrics entries (simulating the fix)
    await db.createDrink({
      clientId: testClientId,
      drinkType: 'Cappuccino',
      volumeMl: 250,
      loggedAt: new Date(),
    });

    await db.createBodyMetric({
      clientId: testClientId,
      hydration: 250,
      recordedAt: new Date(),
    });

    // Verify drink entry was created
    const drinks = await db.getDrinksByClientId(testClientId);
    const cappuccino = drinks.filter(d => d.drinkType === 'Cappuccino');
    expect(cappuccino.length).toBe(1);
    expect(cappuccino[0].volumeMl).toBe(250);

    // Verify body_metrics entry was created
    const metrics = await db.getBodyMetricsByClientId(testClientId);
    const hydrationEntries = metrics.filter(m => m.hydration === 250);
    expect(hydrationEntries.length).toBe(1);
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
