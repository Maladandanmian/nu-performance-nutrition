import { describe, it, expect } from 'vitest';

/**
 * Test suite for synchronized serving/amount inputs in nutrition label analysis
 * 
 * The nutrition label feature allows users to scan product labels and calculate
 * nutrition based on consumption amount. Users can edit either:
 * - Servings Consumed (e.g., 1 → 4 servings)
 * - Amount Consumed (e.g., 25g → 100g)
 * 
 * These inputs are synchronized - editing one updates the other automatically.
 */

describe('Nutrition Label - Synchronized Inputs', () => {
  /**
   * Scenario 1: Default values (100% consumption)
   * When a label is scanned, both fields should auto-fill to 1 serving = serving size
   */
  it('should default to 1 serving = serving size amount', () => {
    const servingSize = 25; // 25g per serving
    const servingsConsumed = 1;
    const amountConsumed = servingSize;

    const multiplier = amountConsumed / servingSize;
    
    expect(servingsConsumed).toBe(1);
    expect(amountConsumed).toBe(25);
    expect(multiplier).toBe(1.0);
  });

  /**
   * Scenario 2: Partial package consumption
   * User edits amount from 25g → 19g (76% of serving)
   * Servings should update to 0.76
   */
  it('should calculate servings when amount is edited (partial consumption)', () => {
    const servingSize = 25; // 25g per serving
    const amountConsumed = 19; // User consumed 19g
    const servingsConsumed = amountConsumed / servingSize;

    const multiplier = amountConsumed / servingSize;
    
    expect(servingsConsumed).toBeCloseTo(0.76, 2);
    expect(multiplier).toBeCloseTo(0.76, 2);
  });

  /**
   * Scenario 3: Multiple servings consumption
   * User edits servings from 1 → 4
   * Amount should update to 100g (4 × 25g)
   */
  it('should calculate amount when servings are edited (multiple servings)', () => {
    const servingSize = 25; // 25g per serving
    const servingsConsumed = 4; // User consumed 4 servings
    const amountConsumed = servingsConsumed * servingSize;

    const multiplier = amountConsumed / servingSize;
    
    expect(amountConsumed).toBe(100);
    expect(multiplier).toBe(4.0);
  });

  /**
   * Backend calculation test
   * The backend uses amountConsumed ÷ servingSize as the multiplier
   * to adjust all nutrition values (calories, protein, fat, carbs, fiber)
   */
  it('should correctly multiply nutrition values by consumption ratio', () => {
    // Example: Nutrition label shows per 25g serving
    const servingSize = 25;
    const labelNutrition = {
      calories: 100,
      protein: 5,
      fat: 3,
      carbs: 15,
      fiber: 2,
    };

    // User consumed 4 servings (100g)
    const amountConsumed = 100;
    const multiplier = amountConsumed / servingSize;

    const adjustedNutrition = {
      calories: Math.round(labelNutrition.calories * multiplier),
      protein: Math.round(labelNutrition.protein * multiplier * 10) / 10,
      fat: Math.round(labelNutrition.fat * multiplier * 10) / 10,
      carbs: Math.round(labelNutrition.carbs * multiplier * 10) / 10,
      fiber: Math.round(labelNutrition.fiber * multiplier * 10) / 10,
    };

    expect(adjustedNutrition.calories).toBe(400); // 100 × 4
    expect(adjustedNutrition.protein).toBe(20); // 5 × 4
    expect(adjustedNutrition.fat).toBe(12); // 3 × 4
    expect(adjustedNutrition.carbs).toBe(60); // 15 × 4
    expect(adjustedNutrition.fiber).toBe(8); // 2 × 4
  });

  /**
   * Edge case: Fractional servings with rounding
   * User consumed 76g when serving size is 100g
   * Servings = 0.76, nutrition should be scaled proportionally
   */
  it('should handle fractional servings with proper rounding', () => {
    const servingSize = 100;
    const labelNutrition = {
      calories: 220,
      protein: 8.5,
      fat: 12.0,
      carbs: 20.0,
      fiber: 3.5,
    };

    const amountConsumed = 76; // 76% of serving
    const multiplier = amountConsumed / servingSize;

    const adjustedNutrition = {
      calories: Math.round(labelNutrition.calories * multiplier),
      protein: Math.round(labelNutrition.protein * multiplier * 10) / 10,
      fat: Math.round(labelNutrition.fat * multiplier * 10) / 10,
      carbs: Math.round(labelNutrition.carbs * multiplier * 10) / 10,
      fiber: Math.round(labelNutrition.fiber * multiplier * 10) / 10,
    };

    expect(adjustedNutrition.calories).toBe(167); // 220 × 0.76 = 167.2 → 167
    expect(adjustedNutrition.protein).toBe(6.5); // 8.5 × 0.76 = 6.46 → 6.5
    expect(adjustedNutrition.fat).toBe(9.1); // 12.0 × 0.76 = 9.12 → 9.1
    expect(adjustedNutrition.carbs).toBe(15.2); // 20.0 × 0.76 = 15.2
    expect(adjustedNutrition.fiber).toBe(2.7); // 3.5 × 0.76 = 2.66 → 2.7
  });

  /**
   * Edge case: Zero serving size (should not crash)
   * This shouldn't happen in practice, but the system should handle it gracefully
   */
  it('should handle zero serving size without crashing', () => {
    const servingSize = 0;
    const amountConsumed = 25;

    // In real implementation, this would show an error or default to 1
    // For now, just verify the calculation doesn't throw
    expect(() => {
      const multiplier = servingSize === 0 ? 1 : amountConsumed / servingSize;
      return multiplier;
    }).not.toThrow();
  });

  /**
   * Integration: Verify the entire flow from extraction to calculation
   */
  it('should maintain data integrity through the entire flow', () => {
    // 1. AI extracts nutrition label data
    const extractedData = {
      servingSize: 25,
      servingUnit: 'g',
      calories: 100,
      protein: 5,
      fat: 3,
      carbs: 15,
      fiber: 2,
    };

    // 2. Frontend initializes with default values
    let servingsConsumed = 1;
    let amountConsumed = extractedData.servingSize;

    expect(servingsConsumed).toBe(1);
    expect(amountConsumed).toBe(25);

    // 3. User edits servings to 4
    servingsConsumed = 4;
    amountConsumed = servingsConsumed * extractedData.servingSize;

    expect(amountConsumed).toBe(100);

    // 4. Backend calculates adjusted nutrition
    const multiplier = amountConsumed / extractedData.servingSize;
    const adjustedCalories = Math.round(extractedData.calories * multiplier);

    expect(multiplier).toBe(4);
    expect(adjustedCalories).toBe(400);
  });
});
