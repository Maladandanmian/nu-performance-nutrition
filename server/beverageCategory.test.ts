import { describe, it, expect } from 'vitest';
import { estimateBeverageNutrition } from './beverageNutrition';
import { calculateNutritionScore } from './qwenVision';

describe('Beverage Category Scoring', () => {
  it('should assign energy_drink category to Red Bull and apply penalty', async () => {
    const redBullNutrition = await estimateBeverageNutrition('red bull', 500);
    
    console.log('[Test] Red Bull nutrition:', redBullNutrition);
    
    // Verify category is assigned
    expect(redBullNutrition.category).toBe('energy_drink');
    
    // Verify nutrition values are reasonable
    expect(redBullNutrition.calories).toBeGreaterThan(150); // 500ml Red Bull ~220 kcal
    expect(redBullNutrition.carbs).toBeGreaterThan(40); // High sugar content
  });

  it('should assign juice_vegetable category to vegetable juice and apply reward', async () => {
    const veggieJuiceNutrition = await estimateBeverageNutrition('mixed vegetable juice', 500);
    
    console.log('[Test] Vegetable juice nutrition:', veggieJuiceNutrition);
    
    // Verify category is assigned
    expect(veggieJuiceNutrition.category).toBe('juice_vegetable');
    
    // Verify nutrition values are reasonable
    expect(veggieJuiceNutrition.calories).toBeGreaterThan(50); // Vegetable juice has calories
    expect(veggieJuiceNutrition.fibre).toBeGreaterThanOrEqual(0); // Should have some fiber
  });

  it('should give different scores for Red Bull vs vegetable juice with same meal', { timeout: 15000 }, async () => {
    // Get beverage nutrition
    const redBullNutrition = await estimateBeverageNutrition('red bull', 500);
    const veggieJuiceNutrition = await estimateBeverageNutrition('mixed vegetable juice', 500);
    
    // Mock goals (typical daily targets)
    const goals = {
      caloriesTarget: 2000,
      proteinTarget: 150,
      fatTarget: 65,
      carbsTarget: 250,
      fibreTarget: 25,
    };
    
    // Mock today's totals (empty, start of day)
    const todaysTotals = {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
    };
    
    // Mock meal nutrition (balanced stir-fry)
    const mealNutrition = {
      calories: 870,
      protein: 55,
      fat: 17,
      carbs: 123,
      fibre: 8,
    };
    
    // Calculate combined nutrition for Red Bull meal
    const redBullMeal = {
      calories: mealNutrition.calories + redBullNutrition.calories,
      protein: mealNutrition.protein + redBullNutrition.protein,
      fat: mealNutrition.fat + redBullNutrition.fat,
      carbs: mealNutrition.carbs + redBullNutrition.carbs,
      fibre: mealNutrition.fibre + redBullNutrition.fibre,
    };
    
    // Calculate combined nutrition for vegetable juice meal
    const veggieJuiceMeal = {
      calories: mealNutrition.calories + veggieJuiceNutrition.calories,
      protein: mealNutrition.protein + veggieJuiceNutrition.protein,
      fat: mealNutrition.fat + veggieJuiceNutrition.fat,
      carbs: mealNutrition.carbs + veggieJuiceNutrition.carbs,
      fibre: mealNutrition.fibre + veggieJuiceNutrition.fibre,
    };
    
    // Calculate scores WITH beverage category
    const redBullScore = calculateNutritionScore(
      redBullMeal,
      goals,
      todaysTotals,
      new Date(),
      redBullNutrition.category
    );
    
    const veggieJuiceScore = calculateNutritionScore(
      veggieJuiceMeal,
      goals,
      todaysTotals,
      new Date(),
      veggieJuiceNutrition.category
    );
    
    console.log('[Test] Red Bull meal score:', redBullScore);
    console.log('[Test] Vegetable juice meal score:', veggieJuiceScore);
    console.log('[Test] Red Bull meal nutrition:', redBullMeal);
    console.log('[Test] Vegetable juice meal nutrition:', veggieJuiceMeal);
    
    // Vegetable juice should have a HIGHER score than Red Bull
    // Red Bull gets -2 penalty, vegetable juice gets +0.5 reward
    expect(veggieJuiceScore).toBeGreaterThan(redBullScore);
    
    // Score difference should be at least 1 point (due to -2 vs +0.5 modifiers)
    expect(veggieJuiceScore - redBullScore).toBeGreaterThanOrEqual(1);
  });

  it('should give same score without category parameter (backward compatibility)', () => {
    const mealNutrition = {
      calories: 870,
      protein: 55,
      fat: 17,
      carbs: 123,
      fibre: 8,
    };
    
    const goals = {
      caloriesTarget: 2000,
      proteinTarget: 150,
      fatTarget: 65,
      carbsTarget: 250,
      fibreTarget: 25,
    };
    
    const todaysTotals = {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
    };
    
    // Calculate score without category (old behavior)
    const scoreWithoutCategory = calculateNutritionScore(
      mealNutrition,
      goals,
      todaysTotals,
      new Date()
    );
    
    // Calculate score with undefined category (should be same)
    const scoreWithUndefined = calculateNutritionScore(
      mealNutrition,
      goals,
      todaysTotals,
      new Date(),
      undefined
    );
    
    expect(scoreWithoutCategory).toBe(scoreWithUndefined);
    expect(scoreWithoutCategory).toBeGreaterThanOrEqual(1);
    expect(scoreWithoutCategory).toBeLessThanOrEqual(5);
  });
});
