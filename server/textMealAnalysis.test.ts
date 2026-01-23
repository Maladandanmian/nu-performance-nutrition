import { describe, it, expect } from 'vitest';
import { analyzeTextMeal } from './textMealAnalysis';

describe('Text Meal Analysis', () => {
  it('should analyze a poke bowl description and break it into components', async () => {
    const result = await analyzeTextMeal('hamachi poke bowl with sesame sauce');
    
    expect(result).toBeDefined();
    expect(result.overallDescription).toBeTruthy();
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items.length).toBeGreaterThan(0);
    
    // Should identify common poke bowl components
    const itemDescriptions = result.items.map(item => item.description.toLowerCase());
    const hasRice = itemDescriptions.some(desc => desc.includes('rice'));
    const hasFish = itemDescriptions.some(desc => desc.includes('hamachi') || desc.includes('fish') || desc.includes('yellowtail'));
    
    expect(hasRice || hasFish).toBe(true); // At least one core component should be identified
  }, 30000); // 30 second timeout for AI call

  it('should analyze french toast and break it into components', async () => {
    const result = await analyzeTextMeal('french toast with maple syrup');
    
    expect(result).toBeDefined();
    expect(result.overallDescription).toBeTruthy();
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items.length).toBeGreaterThan(0);
    
    // Should identify french toast components
    const itemDescriptions = result.items.map(item => item.description.toLowerCase());
    const hasToast = itemDescriptions.some(desc => desc.includes('toast') || desc.includes('bread'));
    const hasSyrup = itemDescriptions.some(desc => desc.includes('syrup') || desc.includes('maple'));
    
    expect(hasToast || hasSyrup).toBe(true); // At least one core component should be identified
  }, 30000);

  it('should handle pasta dishes with multiple components', async () => {
    const result = await analyzeTextMeal('spaghetti carbonara with bacon and parmesan');
    
    expect(result).toBeDefined();
    expect(result.overallDescription).toBeTruthy();
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items.length).toBeGreaterThan(0);
    
    // Should identify pasta components
    const itemDescriptions = result.items.map(item => item.description.toLowerCase());
    const hasPasta = itemDescriptions.some(desc => desc.includes('pasta') || desc.includes('spaghetti'));
    const hasBacon = itemDescriptions.some(desc => desc.includes('bacon'));
    
    expect(hasPasta || hasBacon).toBe(true); // At least one core component should be identified
  }, 30000);

  it('should include quantity estimates in item descriptions', async () => {
    const result = await analyzeTextMeal('two eggs and toast');
    
    expect(result).toBeDefined();
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items.length).toBeGreaterThan(0);
    
    // At least one item should have a quantity indicator
    const hasQuantity = result.items.some(item => {
      const desc = item.description.toLowerCase();
      return /\d+|one|two|three|cup|slice|tbsp|tsp|oz/.test(desc);
    });
    
    expect(hasQuantity).toBe(true);
  }, 30000);
});
