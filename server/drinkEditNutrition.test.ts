import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';
import { estimateBeverageNutrition } from './beverageNutrition';

describe('Drink Edit Nutrition Update', () => {
  let testClientId: number;
  let testDrinkId: number;

  beforeAll(async () => {
    // Create a test client with random PIN to avoid duplicates
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const clientResult = await db.createClient({
      name: 'Drink Edit Test Client',
      email: `drinkedit${randomPin}@test.com`,
      pin: randomPin,
      trainerId: 1,
    });
    testClientId = Number(clientResult[0].insertId);

    // Create initial drink: Full fat dairy milk 300ml
    const initialNutrition = await estimateBeverageNutrition('Full fat dairy milk', 300);
    const drinkResult = await db.createDrink({
      clientId: testClientId,
      drinkType: 'Full fat dairy milk',
      volumeMl: 300,
      calories: initialNutrition.calories,
      protein: initialNutrition.protein,
      fat: initialNutrition.fat,
      carbs: initialNutrition.carbs,
      fibre: initialNutrition.fibre,
      loggedAt: new Date(),
    });
    testDrinkId = Number(drinkResult[0].insertId);

    console.log('[Test Setup] Created drink:', {
      drinkId: testDrinkId,
      drinkType: 'Full fat dairy milk',
      volumeMl: 300,
      calories: initialNutrition.calories,
    });
  });

  it('should update nutrition values when drink type changes from dairy milk to oat milk', async () => {
    // Get initial drink data
    const initialDrinks = await db.getDrinksByClientId(testClientId);
    const initialDrink = initialDrinks.find(d => d.id === testDrinkId);
    console.log('[Test] Initial drink:', {
      drinkType: initialDrink?.drinkType,
      calories: initialDrink?.calories,
      protein: initialDrink?.protein,
    });

    expect(initialDrink?.drinkType).toBe('Full fat dairy milk');
    const initialCalories = initialDrink?.calories || 0;
    expect(initialCalories).toBeGreaterThan(150); // Dairy milk should be ~189 cal

    // Estimate nutrition for oat milk 300ml
    const oatMilkNutrition = await estimateBeverageNutrition('oat milk', 300);
    console.log('[Test] Oat milk nutrition:', oatMilkNutrition);

    // Update drink to oat milk with new nutrition values
    await db.updateDrink(testDrinkId, {
      drinkType: 'oat milk',
      volumeMl: 300,
      calories: oatMilkNutrition.calories,
      protein: oatMilkNutrition.protein,
      fat: oatMilkNutrition.fat,
      carbs: oatMilkNutrition.carbs,
      fibre: oatMilkNutrition.fibre,
    });

    // Verify drink was updated with new nutrition values
    const updatedDrinks = await db.getDrinksByClientId(testClientId);
    const updatedDrink = updatedDrinks.find(d => d.id === testDrinkId);
    console.log('[Test] Updated drink:', {
      drinkType: updatedDrink?.drinkType,
      calories: updatedDrink?.calories,
      protein: updatedDrink?.protein,
    });

    expect(updatedDrink?.drinkType).toBe('oat milk');
    expect(updatedDrink?.volumeMl).toBe(300);
    
    // Verify nutrition values changed from initial values
    // (Database may round decimals, so we just verify values changed, not exact match)
    expect(updatedDrink?.calories).not.toBe(initialCalories);
    expect(updatedDrink?.calories).toBeLessThan(initialCalories); // Oat milk has fewer calories than dairy milk
    
    // Verify the updated values are in the expected range for oat milk
    expect(updatedDrink?.calories).toBeGreaterThan(100);
    expect(updatedDrink?.calories).toBeLessThan(180);
    
    console.log('[Test] ✅ Nutrition values successfully updated from dairy milk to oat milk');
  }, 30000); // 30 second timeout for AI calls
});
