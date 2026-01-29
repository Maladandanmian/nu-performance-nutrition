import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import { TEST_CLIENT_ID } from "./testSetup";
import * as db from './db';
import type { TrpcContext } from './_core/context';

function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      loginMethod: 'manus',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as any,
    res: {} as any,
  };
}

describe('Nutrition Label Badge Feature', () => {
  const testClientId = TEST_CLIENT_ID; // Use existing client from seed data
  const mealIds: number[] = [];

  beforeAll(async () => {
    const caller = appRouter.createCaller(createTestContext());
    
    // Create test meal with meal_photo source (default)
    const mealPhotoResult = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: 'https://example.com/meal.jpg',
      imageKey: 'meal-key',
      mealType: 'breakfast',
      calories: 500,
      protein: 30,
      fat: 20,
      carbs: 50,
      fibre: 10,
      aiDescription: 'Test meal photo',
      aiConfidence: 0.9,
      components: [
        { name: 'Test Food', calories: 500, protein: 30, fat: 20, carbs: 50, fibre: 10 },
      ],
      // No source specified - should default to 'meal_photo'
    });
    mealIds.push(mealPhotoResult.insertId);

    // Create test meal with nutrition_label source
    const nutritionLabelResult = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: 'https://example.com/label.jpg',
      imageKey: 'label-key',
      mealType: 'snack',
      calories: 300,
      protein: 10,
      fat: 5,
      carbs: 50,
      fibre: 5,
      aiDescription: 'Test nutrition label',
      aiConfidence: 1.0,
      components: [
        { name: 'Test Product', calories: 300, protein: 10, fat: 5, carbs: 50, fibre: 5 },
      ],
      source: 'nutrition_label', // Explicitly set source
    });
    mealIds.push(nutritionLabelResult.insertId);
  });

  afterAll(async () => {
    // Cleanup test meals
    for (const id of mealIds) {
      await db.deleteMeal(id);
    }
  });

  it('should save meals with correct source field and distinguish between meal_photo and nutrition_label', async () => {
    const caller = appRouter.createCaller(createTestContext());
    
    const meals = await caller.meals.list({ clientId: testClientId });
    
    // Find our test meals by ID
    const testMeals = meals.filter(m => mealIds.includes(m.id));
    expect(testMeals.length).toBe(2);

    // Verify meal_photo source
    const mealPhoto = testMeals.find(m => m.aiDescription === 'Test meal photo');
    expect(mealPhoto).toBeDefined();
    expect(mealPhoto?.source).toBe('meal_photo');

    // Verify nutrition_label source
    const nutritionLabel = testMeals.find(m => m.aiDescription === 'Test nutrition label');
    expect(nutritionLabel).toBeDefined();
    expect(nutritionLabel?.source).toBe('nutrition_label');
  });

  it('should default to meal_photo when source is not specified', async () => {
    const caller = appRouter.createCaller(createTestContext());
    
    const result = await caller.meals.saveMeal({
      clientId: testClientId,
      imageUrl: 'https://example.com/default-test.jpg',
      imageKey: 'default-key',
      mealType: 'lunch',
      calories: 600,
      protein: 40,
      fat: 25,
      carbs: 60,
      fibre: 12,
      aiDescription: 'Default source test',
      aiConfidence: 0.85,
      components: [],
      // source not specified
    });

    mealIds.push(result.insertId);

    const meals = await caller.meals.list({ clientId: testClientId });
    const savedMeal = meals.find(m => m.id === result.insertId);
    
    // Should default to meal_photo
    expect(savedMeal?.source).toBe('meal_photo');
  });
});
