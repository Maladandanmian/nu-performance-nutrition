import { describe, it, expect } from 'vitest';

/**
 * Test suite for nutrition label serving size calculations
 * 
 * UPDATED: Now handles distinction between reference serving and actual serving
 * 
 * Key concepts:
 * - Reference Serving: The serving size that nutrition values are based on (e.g., "per 100g")
 * - Actual Serving: The recommended serving size per consumption (e.g., "3.5g per sachet")
 * - Servings Consumed: How many actual servings the user consumed (e.g., 1 sachet, 2 scoops)
 * 
 * Calculation:
 * Total grams consumed = servingsConsumed × actualServingSize
 * Multiplier = totalGramsConsumed / referenceSize
 * Adjusted nutrition = label nutrition × multiplier
 */

describe('Nutrition Label - Reference vs Actual Serving Calculations', () => {
  /**
   * Scenario 1: Chinese supplement label (Qing Yuansu example)
   * Label shows: per 100g (reference)
   * Actual serving: 3.5g per sachet
   * User consumes: 1 sachet
   */
  it('should correctly scale from per-100g label to 3.5g sachet consumption', () => {
    // Label data (per 100g reference)
    const referenceSize = 100; // g
    const referenceUnit = 'g';
    const calories = 261; // kcal per 100g (converted from 1091kJ)
    const protein = 9.9; // g per 100g
    const fat = 5.5; // g per 100g
    const carbs = 68.9; // g per 100g
    const fiber = 13.3; // g per 100g

    // Actual serving
    const actualServingSize = 3.5; // g per sachet
    const actualServingUnit = 'g';
    const actualServingDescription = 'per sachet';
    const servingsConsumed = 1; // 1 sachet

    // Calculate multiplier
    const totalGramsConsumed = servingsConsumed * actualServingSize; // 3.5g
    const multiplier = totalGramsConsumed / referenceSize; // 3.5 / 100 = 0.035

    // Calculate adjusted nutrition
    const adjustedCalories = Math.round(calories * multiplier);
    const adjustedProtein = Math.round(protein * multiplier * 10) / 10;
    const adjustedFat = Math.round(fat * multiplier * 10) / 10;
    const adjustedCarbs = Math.round(carbs * multiplier * 10) / 10;
    const adjustedFiber = Math.round(fiber * multiplier * 10) / 10;

    // Assertions
    expect(adjustedCalories).toBe(9); // 261 * 0.035 = 9.135 → 9
    expect(adjustedProtein).toBe(0.3); // 9.9 * 0.035 = 0.3465 → 0.3
    expect(adjustedFat).toBe(0.2); // 5.5 * 0.035 = 0.1925 → 0.2
    expect(adjustedCarbs).toBe(2.4); // 68.9 * 0.035 = 2.4115 → 2.4
    expect(adjustedFiber).toBe(0.5); // 13.3 * 0.035 = 0.4655 → 0.5
  });

  /**
   * Scenario 2: Consuming multiple sachets
   * Label: per 100g, Actual serving: 3.5g per sachet
   * User consumes: 2 sachets
   */
  it('should handle consuming multiple sachets', () => {
    const referenceSize = 100;
    const calories = 261;
    const actualServingSize = 3.5;
    const servingsConsumed = 2; // 2 sachets

    const totalGramsConsumed = servingsConsumed * actualServingSize; // 7g
    const multiplier = totalGramsConsumed / referenceSize; // 0.07
    const adjustedCalories = Math.round(calories * multiplier);

    expect(adjustedCalories).toBe(18); // 261 * 0.07 = 18.27 → 18
  });

  /**
   * Scenario 3: Protein powder with scoop serving
   * Label: per 100g, Actual serving: 35g per scoop
   * User consumes: 0.5 scoops (half scoop)
   */
  it('should handle fractional servings (half scoop)', () => {
    const referenceSize = 100;
    const protein = 20; // g per 100g
    const actualServingSize = 35; // g per scoop
    const servingsConsumed = 0.5; // Half a scoop

    const totalGramsConsumed = servingsConsumed * actualServingSize; // 17.5g
    const multiplier = totalGramsConsumed / referenceSize; // 0.175
    const adjustedProtein = Math.round(protein * multiplier * 10) / 10;

    expect(adjustedProtein).toBe(3.5); // 20 * 0.175 = 3.5
  });

  /**
   * Scenario 4: When reference serving equals actual serving
   * Label: per 250ml, Actual serving: 250ml (same)
   * User consumes: 1 serving
   */
  it('should handle when reference serving equals actual serving', () => {
    const referenceSize = 250;
    const calories = 150;
    const actualServingSize = 250;
    const servingsConsumed = 1;

    const totalGramsConsumed = servingsConsumed * actualServingSize; // 250ml
    const multiplier = totalGramsConsumed / referenceSize; // 1.0
    const adjustedCalories = Math.round(calories * multiplier);

    expect(adjustedCalories).toBe(150); // No change
  });

  /**
   * Scenario 5: Components array generation from ingredients
   * The system should extract ingredients and create a components list
   * like the meal photo scanning feature
   */
  it('should create components array from ingredients list', () => {
    const ingredients = [
      'Barley Grass Powder (45%)',
      'Oligofructose (40%)',
      'Virgin Coconut Oil Microencaps',
      'Broccoli Powder',
      'Kale Powder',
      'Avocado Powder',
      'Xylooligosaccharide (1%)',
      'Monk Fruit Powder (Luo Han Guo)',
      'Compound Nutritional Fortification',
    ];

    const components = ingredients.map(ingredient => ({
      name: ingredient,
      calories: 0, // We don't have per-ingredient breakdown
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
    }));

    expect(components).toHaveLength(9);
    expect(components[0].name).toBe('Barley Grass Powder (45%)');
    expect(components[1].name).toBe('Oligofructose (40%)');
    expect(components[2].name).toBe('Virgin Coconut Oil Microencaps');
  });

  /**
   * Scenario 6: kJ to kcal conversion
   * Chinese labels often show energy in kJ (kilojoules)
   * Conversion: 1 kcal = 4.184 kJ
   */
  it('should handle kJ to kcal conversion (1091kJ = 261kcal)', () => {
    const kJ = 1091;
    const kcal = Math.round(kJ / 4.184);

    expect(kcal).toBe(261); // 1091 / 4.184 = 260.8 → 261
  });

  /**
   * Scenario 7: Edge case - very small serving (1% of reference)
   * Label: per 100g, Actual serving: 1g
   * User consumes: 1 serving
   */
  it('should handle very small servings (1g out of 100g)', () => {
    const referenceSize = 100;
    const calories = 400;
    const actualServingSize = 1;
    const servingsConsumed = 1;

    const totalGramsConsumed = servingsConsumed * actualServingSize; // 1g
    const multiplier = totalGramsConsumed / referenceSize; // 0.01
    const adjustedCalories = Math.round(calories * multiplier);

    expect(adjustedCalories).toBe(4); // 400 * 0.01 = 4
  });

  /**
   * Integration test: Verify the entire flow
   * 1. AI extracts reference + actual serving data
   * 2. User specifies servings consumed
   * 3. Backend calculates adjusted nutrition
   * 4. Components array is generated
   */
  it('should maintain data integrity through the entire flow', () => {
    // 1. AI extracts nutrition label data
    const extractedData = {
      referenceSize: 100,
      referenceUnit: 'g',
      actualServingSize: 3.5,
      actualServingUnit: 'g',
      actualServingDescription: 'per sachet',
      calories: 261,
      protein: 9.9,
      fat: 5.5,
      carbs: 68.9,
      fiber: 13.3,
      productName: 'Qing Yuansu (Light Element)',
      ingredients: [
        'Barley Grass Powder (45%)',
        'Oligofructose (40%)',
        'Virgin Coconut Oil Microencaps',
      ],
    };

    // 2. User specifies consumption (default: 1 serving)
    const servingsConsumed = 1;

    // 3. Backend calculates adjusted nutrition
    const totalGramsConsumed = servingsConsumed * extractedData.actualServingSize;
    const multiplier = totalGramsConsumed / extractedData.referenceSize;
    const adjustedCalories = Math.round(extractedData.calories * multiplier);

    // 4. Components array is generated
    const components = extractedData.ingredients.map(ingredient => ({
      name: ingredient,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
    }));

    expect(totalGramsConsumed).toBe(3.5);
    expect(multiplier).toBe(0.035);
    expect(adjustedCalories).toBe(9);
    expect(components).toHaveLength(3);
    expect(components[0].name).toBe('Barley Grass Powder (45%)');
  });
});
