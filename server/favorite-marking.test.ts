import { describe, it, expect } from 'vitest';
import * as db from './db';
import { getTestClientId, createTestContext, cleanupTestData } from './test-helpers';

describe('Favorite Marking Consistency', () => {
  it('should preserve favorite status when duplicating via logFavorite', async () => {
    const clientId = await getTestClientId();
    
    // Create a test meal and mark it as favorite
    const testMeal = await db.createMeal({
      clientId,
      mealType: 'Snack',
      aiDescription: 'Test Favorite Meal',
      calories: 200,
      protein: 10,
      fat: 5,
      carbs: 20,
      fibre: 3,
      nutritionScore: 3,
      loggedAt: new Date(),
      source: 'photo',
      imageUrl: 'https://example.com/test.jpg',
      imageKey: 'test/test.jpg',
      components: JSON.stringify([{ name: 'Test Food', percentage: 100 }]),
    });
    
    // Get the meal ID from the insert result
    const meals = await db.getMealsByClientId(clientId);
    const originalMeal = meals.find(m => m.aiDescription === 'Test Favorite Meal');
    expect(originalMeal).toBeDefined();
    
    // Mark as favorite
    await db.toggleMealFavorite(originalMeal!.id, clientId);
    
    // Verify it's marked as favorite
    const favoriteMeal = await db.getMealById(originalMeal!.id);
    expect(favoriteMeal?.isFavorite).toBe(1);
    
    // Duplicate with preserveFavorite = true (simulating logFavorite)
    const duplicatedMeal = await db.duplicateMeal(originalMeal!.id, new Date(), true);
    
    // Verify the duplicated meal is also marked as favorite
    expect(duplicatedMeal).toBeDefined();
    expect(duplicatedMeal?.isFavorite).toBe(1);
    
    // Cleanup
    await cleanupTestData(clientId);
  });
  
  it('should preserve favorite status when duplicating drinks via logFavorite', async () => {
    const clientId = await getTestClientId();
    
    // Create a test drink and mark it as favorite
    await db.createDrink({
      clientId,
      drinkType: 'Water',
      volumeMl: 500,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      loggedAt: new Date(),
    });
    
    // Get the drink ID
    const drinks = await db.getDrinksByClientId(clientId);
    const originalDrink = drinks[0];
    expect(originalDrink).toBeDefined();
    
    // Mark as favorite
    await db.toggleDrinkFavorite(originalDrink.id, clientId);
    
    // Verify it's marked as favorite
    const favoriteDrink = await db.getDrinkById(originalDrink.id);
    expect(favoriteDrink?.isFavorite).toBe(1);
    
    // Duplicate with preserveFavorite = true (simulating logFavorite)
    const duplicatedDrink = await db.duplicateDrink(originalDrink.id, new Date(), true);
    
    // Verify the duplicated drink is also marked as favorite
    expect(duplicatedDrink).toBeDefined();
    expect(duplicatedDrink?.isFavorite).toBe(1);
    
    // Cleanup
    await cleanupTestData(clientId);
  });
  
  it('should NOT preserve favorite status when duplicating without preserveFavorite flag', async () => {
    const clientId = await getTestClientId();
    
    // Create a test meal and mark it as favorite
    await db.createMeal({
      clientId,
      mealType: 'Snack',
      aiDescription: 'Test Meal for Repeat',
      calories: 150,
      protein: 8,
      fat: 4,
      carbs: 15,
      fibre: 2,
      nutritionScore: 3,
      loggedAt: new Date(),
      source: 'photo',
      imageUrl: 'https://example.com/test2.jpg',
      imageKey: 'test/test2.jpg',
      components: JSON.stringify([{ name: 'Test Food 2', percentage: 100 }]),
    });
    
    const meals = await db.getMealsByClientId(clientId);
    const originalMeal = meals.find(m => m.aiDescription === 'Test Meal for Repeat');
    expect(originalMeal).toBeDefined();
    
    // Mark as favorite
    await db.toggleMealFavorite(originalMeal!.id, clientId);
    
    // Duplicate without preserveFavorite (default behavior for repeatLast)
    const duplicatedMeal = await db.duplicateMeal(originalMeal!.id, new Date(), false);
    
    // Verify the duplicated meal is NOT marked as favorite
    expect(duplicatedMeal).toBeDefined();
    expect(duplicatedMeal?.isFavorite).toBe(0);
    
    // Cleanup
    await cleanupTestData(clientId);
  });
});
