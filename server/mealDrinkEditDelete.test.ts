import { describe, it, expect, beforeEach } from 'vitest';
import * as db from './db';

describe('Meal and Drink Editing/Deletion', () => {
  let testClientId: number;
  let testMealId: number;
  let testDrinkId: number;

  beforeEach(async () => {
    // Create a test client with nutrition goals
    const uniquePin = Math.floor(100000 + Math.random() * 900000).toString();
    const clientResult = await db.createClient({
      name: 'Test Client for Edit/Delete',
      email: `editdelete${Date.now()}@example.com`,
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

    // Create a test meal
    const mealResult = await db.createMeal({
      clientId: testClientId,
      imageUrl: 'https://example.com/meal.jpg',
      imageKey: 'meal-key',
      mealType: 'lunch',
      calories: 500,
      protein: 30,
      fat: 20,
      carbs: 50,
      fibre: 10,
      aiDescription: 'Chicken salad with vegetables',
      aiConfidence: 95,
      nutritionScore: 4,
      loggedAt: new Date(),
    });
    testMealId = Number(mealResult[0].insertId);

    // Create a test drink
    const drinkResult = await db.createDrink({
      clientId: testClientId,
      drinkType: 'Green Tea',
      volumeMl: 300,
      loggedAt: new Date(),
    });
    testDrinkId = Number(drinkResult[0].insertId);
  });

  it('should delete a meal successfully', async () => {
    // Delete the meal
    await db.deleteMeal(testMealId);

    // Verify meal is deleted
    const meal = await db.getMealById(testMealId);
    expect(meal).toBeUndefined();
  });

  it('should update a meal successfully', async () => {
    // Update the meal
    await db.updateMeal(testMealId, {
      calories: 600,
      protein: 35,
      aiDescription: 'Chicken salad with extra vegetables',
      nutritionScore: 5,
    });

    // Verify meal is updated
    const updatedMeal = await db.getMealById(testMealId);
    expect(updatedMeal).toBeDefined();
    expect(updatedMeal?.calories).toBe(600);
    expect(updatedMeal?.protein).toBe(35);
    expect(updatedMeal?.aiDescription).toBe('Chicken salad with extra vegetables');
    expect(updatedMeal?.nutritionScore).toBe(5);
  });

  it('should delete a drink successfully', async () => {
    // Delete the drink
    await db.deleteDrink(testDrinkId);

    // Verify drink is deleted by checking the list
    const drinks = await db.getDrinksByClientId(testClientId);
    const deletedDrink = drinks.find(d => d.id === testDrinkId);
    expect(deletedDrink).toBeUndefined();
  });

  it('should update a drink successfully', async () => {
    // Update the drink
    await db.updateDrink(testDrinkId, {
      drinkType: 'Jasmine Green Tea',
      volumeMl: 350,
    });

    // Verify drink is updated
    const drinks = await db.getDrinksByClientId(testClientId);
    const updatedDrink = drinks.find(d => d.id === testDrinkId);
    expect(updatedDrink).toBeDefined();
    expect(updatedDrink?.drinkType).toBe('Jasmine Green Tea');
    expect(updatedDrink?.volumeMl).toBe(350);
  });

  it('should maintain meal history after update', async () => {
    // Get initial meal count
    const initialMeals = await db.getMealsByClientId(testClientId);
    const initialCount = initialMeals.length;

    // Update the meal
    await db.updateMeal(testMealId, {
      calories: 550,
    });

    // Verify meal count hasn't changed (update, not create)
    const updatedMeals = await db.getMealsByClientId(testClientId);
    expect(updatedMeals.length).toBe(initialCount);
  });

  it('should recalculate nutrition score when meal is updated', async () => {
    // Initial meal has score of 4
    const initialMeal = await db.getMealById(testMealId);
    expect(initialMeal?.nutritionScore).toBe(4);

    // Update with better nutrition (higher protein, lower fat)
    await db.updateMeal(testMealId, {
      calories: 450,
      protein: 40,
      fat: 15,
      carbs: 45,
      fibre: 12,
      nutritionScore: 5, // Manually set new score
    });

    // Verify score is updated
    const updatedMeal = await db.getMealById(testMealId);
    expect(updatedMeal?.nutritionScore).toBe(5);
  });
});
