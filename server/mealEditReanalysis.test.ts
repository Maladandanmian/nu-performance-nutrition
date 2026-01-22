import { describe, it, expect } from 'vitest';
import { analyzeMealNutrition } from './mealNutritionAnalysis';

describe('Meal Edit Re-analysis', () => {
  it('should recalculate nutrition when adding items to an existing meal', async () => {
    // Simulate editing a light salad and adding 2 fried eggs
    const itemDescriptions = [
      '1 cup mixed greens',
      '1/4 cup cucumber slices',
      '1/4 cup cherry tomatoes',
      '2 tablespoons radish slices',
      '2 fried eggs', // Added during edit
    ];

    const result = await analyzeMealNutrition(itemDescriptions);

    console.log('[Test] Analysis result:', JSON.stringify(result, null, 2));
    console.log('[Test] Total calories:', result.calories);
    console.log('[Test] Total protein:', result.protein);
    console.log('[Test] Components:', result.components);

    // Verify that the nutrition includes the eggs
    // 2 fried eggs should add ~180 kcal and ~12g protein
    // Light salad is ~30 kcal, ~1g protein
    // Total should be ~210 kcal, ~13g protein
    expect(result.calories).toBeGreaterThan(150); // Should be much more than 30 kcal
    expect(result.protein).toBeGreaterThan(10); // Should be much more than 1g protein
    
    // Verify components array includes all items
    expect(result.components).toBeDefined();
    expect(result.components.length).toBeGreaterThanOrEqual(5);
    
    // Check if eggs are in the components
    const eggComponent = result.components.find((c: any) => 
      c.name.toLowerCase().includes('egg')
    );
    expect(eggComponent).toBeDefined();
    expect(eggComponent?.calories).toBeGreaterThan(100); // Eggs should contribute significant calories
  }, 30000); // 30 second timeout for AI call
});
