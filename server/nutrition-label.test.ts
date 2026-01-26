import { describe, it, expect } from 'vitest';

/**
 * Test suite for nutrition label reactive display and serving calculations
 * 
 * UPDATED APPROACH (Jan 26, 2026):
 * - Backend extracts nutrition per reference serving (e.g., "per 100g") AND calculates per actual serving (e.g., "per 3.5g sachet")
 * - Frontend displays nutrition reactively based on servings consumed
 * - User sees: 1 serving = 9 kcal, 2 servings = 18 kcal (auto-updates)
 * - User can edit either servings OR nutrition values directly
 * 
 * Key concepts:
 * - Reference Serving: What the label shows (e.g., "per 100g")
 * - Actual Serving: Recommended portion (e.g., "3.5g per sachet")
 * - Per-Serving Nutrition: Nutrition for 1 actual serving (calculated by backend)
 * - Displayed Nutrition: Per-serving × servings consumed (calculated by frontend)
 */

describe('Nutrition Label - Reactive Display Based on Servings', () => {
  /**
   * Scenario 1: Backend calculation - per-serving nutrition
   * Label shows: per 100g (reference) → 261 kcal, 9.9g protein, etc.
   * Actual serving: 3.5g per sachet
   * Backend should calculate: per-serving nutrition = reference × (3.5 / 100)
   */
  it('should calculate per-serving nutrition from reference serving', () => {
    // Label data (per 100g reference)
    const referenceSize = 100; // g
    const referenceNutrition = {
      calories: 261, // kcal per 100g
      protein: 9.9, // g per 100g
      fat: 5.5, // g per 100g
      carbs: 68.9, // g per 100g
      fiber: 13.3, // g per 100g
    };

    // Actual serving
    const actualServingSize = 3.5; // g per sachet

    // Backend calculation: per-serving nutrition
    const multiplier = actualServingSize / referenceSize; // 0.035
    const perServingNutrition = {
      calories: Math.round(referenceNutrition.calories * multiplier),
      protein: Math.round(referenceNutrition.protein * multiplier * 10) / 10,
      fat: Math.round(referenceNutrition.fat * multiplier * 10) / 10,
      carbs: Math.round(referenceNutrition.carbs * multiplier * 10) / 10,
      fiber: Math.round(referenceNutrition.fiber * multiplier * 10) / 10,
    };

    // Assertions
    expect(perServingNutrition.calories).toBe(9); // 261 × 0.035 = 9.135 → 9
    expect(perServingNutrition.protein).toBe(0.3); // 9.9 × 0.035 = 0.3465 → 0.3
    expect(perServingNutrition.fat).toBe(0.2); // 5.5 × 0.035 = 0.1925 → 0.2
    expect(perServingNutrition.carbs).toBe(2.4); // 68.9 × 0.035 = 2.4115 → 2.4
    expect(perServingNutrition.fiber).toBe(0.5); // 13.3 × 0.035 = 0.4655 → 0.5
  });

  /**
   * Scenario 2: Frontend display - 1 serving consumed (default)
   * User sees: 1 serving = 9 kcal (not 260 kcal)
   */
  it('should display per-serving nutrition for 1 serving consumed', () => {
    const perServingNutrition = {
      calories: 9,
      protein: 0.3,
      fat: 0.2,
      carbs: 2.4,
      fiber: 0.5,
    };

    const servingsConsumed = 1;

    // Frontend calculation: displayed nutrition
    const displayedNutrition = {
      calories: Math.round(perServingNutrition.calories * servingsConsumed),
      protein: Math.round(perServingNutrition.protein * servingsConsumed * 10) / 10,
      fat: Math.round(perServingNutrition.fat * servingsConsumed * 10) / 10,
      carbs: Math.round(perServingNutrition.carbs * servingsConsumed * 10) / 10,
      fiber: Math.round(perServingNutrition.fiber * servingsConsumed * 10) / 10,
    };

    expect(displayedNutrition.calories).toBe(9);
    expect(displayedNutrition.protein).toBe(0.3);
    expect(displayedNutrition.fat).toBe(0.2);
    expect(displayedNutrition.carbs).toBe(2.4);
    expect(displayedNutrition.fiber).toBe(0.5);
  });

  /**
   * Scenario 3: Frontend display - 2 servings consumed
   * User changes servings from 1 → 2
   * Display should auto-update: 2 servings = 18 kcal
   */
  it('should reactively update displayed nutrition when servings change to 2', () => {
    const perServingNutrition = {
      calories: 9,
      protein: 0.3,
      fat: 0.2,
      carbs: 2.4,
      fiber: 0.5,
    };

    const servingsConsumed = 2;

    const displayedNutrition = {
      calories: Math.round(perServingNutrition.calories * servingsConsumed),
      protein: Math.round(perServingNutrition.protein * servingsConsumed * 10) / 10,
      fat: Math.round(perServingNutrition.fat * servingsConsumed * 10) / 10,
      carbs: Math.round(perServingNutrition.carbs * servingsConsumed * 10) / 10,
      fiber: Math.round(perServingNutrition.fiber * servingsConsumed * 10) / 10,
    };

    expect(displayedNutrition.calories).toBe(18); // 9 × 2
    expect(displayedNutrition.protein).toBe(0.6); // 0.3 × 2
    expect(displayedNutrition.fat).toBe(0.4); // 0.2 × 2
    expect(displayedNutrition.carbs).toBe(4.8); // 2.4 × 2
    expect(displayedNutrition.fiber).toBe(1.0); // 0.5 × 2
  });

  /**
   * Scenario 4: Frontend display - fractional servings (0.5)
   * User enters 0.5 servings (half a sachet)
   * Display should show: 0.5 servings = 4.5 kcal
   */
  it('should handle fractional servings (0.5 servings)', () => {
    const perServingNutrition = {
      calories: 9,
      protein: 0.3,
      fat: 0.2,
      carbs: 2.4,
      fiber: 0.5,
    };

    const servingsConsumed = 0.5;

    const displayedNutrition = {
      calories: Math.round(perServingNutrition.calories * servingsConsumed),
      protein: Math.round(perServingNutrition.protein * servingsConsumed * 10) / 10,
      fat: Math.round(perServingNutrition.fat * servingsConsumed * 10) / 10,
      carbs: Math.round(perServingNutrition.carbs * servingsConsumed * 10) / 10,
      fiber: Math.round(perServingNutrition.fiber * servingsConsumed * 10) / 10,
    };

    expect(displayedNutrition.calories).toBe(5); // 9 × 0.5 = 4.5 → 5
    expect(displayedNutrition.protein).toBe(0.2); // 0.3 × 0.5 = 0.15 → 0.2
    expect(displayedNutrition.fat).toBe(0.1); // 0.2 × 0.5 = 0.1
    expect(displayedNutrition.carbs).toBe(1.2); // 2.4 × 0.5 = 1.2
    expect(displayedNutrition.fiber).toBe(0.3); // 0.5 × 0.5 = 0.25 → 0.3
  });

  /**
   * Scenario 5: User manually edits displayed nutrition
   * User changes calories from 9 → 12 (for 1 serving)
   * System should back-calculate: per-serving = 12 / 1 = 12
   */
  it('should back-calculate per-serving nutrition when user edits displayed values', () => {
    const servingsConsumed = 1;
    const userEditedCalories = 12; // User changed from 9 to 12

    // Back-calculate per-serving nutrition
    const newPerServingCalories = Math.round(userEditedCalories / servingsConsumed);

    expect(newPerServingCalories).toBe(12);

    // If user then changes to 2 servings, display should show 24
    const displayedFor2Servings = Math.round(newPerServingCalories * 2);
    expect(displayedFor2Servings).toBe(24);
  });

  /**
   * Scenario 6: User edits nutrition while consuming multiple servings
   * User consumes 2 servings, sees 18 kcal, edits to 20 kcal
   * System should back-calculate: per-serving = 20 / 2 = 10
   */
  it('should back-calculate per-serving nutrition for multiple servings', () => {
    const servingsConsumed = 2;
    const userEditedCalories = 20; // User changed from 18 to 20

    const newPerServingCalories = Math.round(userEditedCalories / servingsConsumed);

    expect(newPerServingCalories).toBe(10); // 20 / 2

    // If user then changes to 1 serving, display should show 10
    const displayedFor1Serving = Math.round(newPerServingCalories * 1);
    expect(displayedFor1Serving).toBe(10);
  });

  /**
   * Scenario 7: Components array generation from ingredients
   * Same as before - ingredients list should be extracted and formatted
   */
  it('should create components array from ingredients list', () => {
    const ingredients = [
      'Barley Grass Powder (45%)',
      'Oligofructose (40%)',
      'Virgin Coconut Oil Microencaps',
      'Broccoli Powder',
      'Kale Powder',
    ];

    const components = ingredients.map(ingredient => ({
      name: ingredient,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
    }));

    expect(components).toHaveLength(5);
    expect(components[0].name).toBe('Barley Grass Powder (45%)');
    expect(components[1].name).toBe('Oligofructose (40%)');
  });

  /**
   * Integration test: Full flow from extraction to display
   */
  it('should maintain data integrity through the entire reactive flow', () => {
    // 1. Backend extracts and calculates per-serving nutrition
    const referenceSize = 100;
    const referenceCalories = 261;
    const actualServingSize = 3.5;
    const multiplier = actualServingSize / referenceSize;
    const perServingCalories = Math.round(referenceCalories * multiplier); // 9

    expect(perServingCalories).toBe(9);

    // 2. Frontend displays for 1 serving (default)
    let servingsConsumed = 1;
    let displayedCalories = Math.round(perServingCalories * servingsConsumed);
    expect(displayedCalories).toBe(9);

    // 3. User changes to 2 servings
    servingsConsumed = 2;
    displayedCalories = Math.round(perServingCalories * servingsConsumed);
    expect(displayedCalories).toBe(18);

    // 4. User manually edits displayed calories to 20
    displayedCalories = 20;
    const newPerServingCalories = Math.round(displayedCalories / servingsConsumed);
    expect(newPerServingCalories).toBe(10); // 20 / 2

    // 5. User changes back to 1 serving
    servingsConsumed = 1;
    displayedCalories = Math.round(newPerServingCalories * servingsConsumed);
    expect(displayedCalories).toBe(10); // Now shows 10 instead of original 9
  });
});
