import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from './routers';
import * as db from './db';

describe('New Meal Logging Flow', () => {
  // Increase timeout for AI calls
  const testTimeout = 30000;
  let testClientId: number;
  let testTrainerId: number;

  beforeAll(async () => {
    // Create test trainer
    const trainerOpenId = `test-trainer-${Date.now()}`;
    await db.upsertUser({
      openId: trainerOpenId,
      name: 'Test Trainer',
      email: `trainer-${Date.now()}@test.com`,
      role: 'admin',
    });
    const trainer = await db.getUserByOpenId(trainerOpenId);
    if (!trainer) throw new Error('Failed to create trainer');
    testTrainerId = trainer.id;

    // Create test client
    const clientResult = await db.createClient({
      trainerId: testTrainerId,
      name: 'Test Client',
      email: `client-${Date.now()}@test.com`,
      pin: `${Math.floor(100000 + Math.random() * 900000)}`,
    });
    testClientId = Number(clientResult[0].insertId);

    // Create nutrition goals for the client
    await db.createNutritionGoal({
      clientId: testClientId,
      caloriesTarget: 2000,
      proteinTarget: 150,
      fatTarget: 65,
      carbsTarget: 250,
      fibreTarget: 25,
      hydrationTarget: 2000,
    });
  });

  it('should identify items from meal image', { timeout: testTimeout }, async () => {
    const caller = appRouter.createCaller({
      user: { id: testTrainerId, role: 'admin', name: 'Test Trainer', email: 'trainer@test.com', openId: 'test' },
      req: {} as any,
      res: {} as any,
    });

    // Create a simple base64 image (1x1 pixel PNG)
    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await caller.meals.identifyItems({
      clientId: testClientId,
      imageBase64: testImage,
    });

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeDefined();
    expect(result.imageKey).toBeDefined();
    expect(result.overallDescription).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('should analyze meal with drink and save to database', { timeout: testTimeout }, async () => {
    const caller = appRouter.createCaller({
      user: { id: testTrainerId, role: 'admin', name: 'Test Trainer', email: 'trainer@test.com', openId: 'test' },
      req: {} as any,
      res: {} as any,
    });

    // First identify items
    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const identifyResult = await caller.meals.identifyItems({
      clientId: testClientId,
      imageBase64: testImage,
    });

    // Then analyze with edited items
    const result = await caller.meals.analyzeMealWithDrink({
      clientId: testClientId,
      imageUrl: identifyResult.imageUrl,
      imageKey: identifyResult.imageKey,
      mealType: 'breakfast',
      itemDescriptions: ['2 fried eggs', '2 slices of toast with butter', '1 cup of orange juice'],
      notes: 'Test meal',
      drinkType: 'Coffee with milk',
      volumeMl: 250,
    });

    expect(result.success).toBe(true);
    expect(result.mealId).toBeDefined();
    expect(result.drinkId).toBeDefined();
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThanOrEqual(5);
    expect(result.mealAnalysis).toBeDefined();
    expect(result.mealAnalysis.calories).toBeGreaterThan(0);
    expect(result.drinkNutrition).toBeDefined();
    expect(result.combinedNutrition).toBeDefined();
    expect(result.combinedNutrition.calories).toBeGreaterThan(result.mealAnalysis.calories);
  });

  it('should analyze meal without drink', { timeout: testTimeout }, async () => {
    const caller = appRouter.createCaller({
      user: { id: testTrainerId, role: 'admin', name: 'Test Trainer', email: 'trainer@test.com', openId: 'test' },
      req: {} as any,
      res: {} as any,
    });

    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const identifyResult = await caller.meals.identifyItems({
      clientId: testClientId,
      imageBase64: testImage,
    });

    const result = await caller.meals.analyzeMealWithDrink({
      clientId: testClientId,
      imageUrl: identifyResult.imageUrl,
      imageKey: identifyResult.imageKey,
      mealType: 'lunch',
      itemDescriptions: ['Grilled chicken breast', 'Steamed broccoli', 'Brown rice'],
      notes: 'Healthy lunch',
    });

    expect(result.success).toBe(true);
    expect(result.mealId).toBeDefined();
    expect(result.drinkId).toBeNull();
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.mealAnalysis).toBeDefined();
    expect(result.drinkNutrition).toBeNull();
    expect(result.combinedNutrition.calories).toBe(result.mealAnalysis.calories);
  });

  it('should save meal and drink to separate tables', { timeout: testTimeout }, async () => {
    const caller = appRouter.createCaller({
      user: { id: testTrainerId, role: 'admin', name: 'Test Trainer', email: 'trainer@test.com', openId: 'test' },
      req: {} as any,
      res: {} as any,
    });

    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const identifyResult = await caller.meals.identifyItems({
      clientId: testClientId,
      imageBase64: testImage,
    });

    const result = await caller.meals.analyzeMealWithDrink({
      clientId: testClientId,
      imageUrl: identifyResult.imageUrl,
      imageKey: identifyResult.imageKey,
      mealType: 'dinner',
      itemDescriptions: ['Salmon fillet', 'Quinoa', 'Mixed vegetables'],
      drinkType: 'Water',
      volumeMl: 500,
    });

    // Verify meal was saved
    const meal = await db.getMealById(result.mealId);
    expect(meal).toBeDefined();
    expect(meal?.clientId).toBe(testClientId);
    expect(meal?.mealType).toBe('dinner');
    expect(meal?.calories).toBeGreaterThan(0);

    // Verify drink was saved
    const drinks = await db.getDrinksByClientId(testClientId, 10);
    const drink = drinks.find(d => d.id === result.drinkId);
    expect(drink).toBeDefined();
    expect(drink?.clientId).toBe(testClientId);
    expect(drink?.drinkType).toBe('Water');
    expect(drink?.volumeMl).toBe(500);
  });
});
