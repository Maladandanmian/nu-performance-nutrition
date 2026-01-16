import { describe, it, expect, vi, beforeEach } from 'vitest';
import { identifyMealItems } from './mealItemIdentification';
import { readNutritionLabel } from './nutritionLabelReader';
import { invokeLLM } from './_core/llm';

// Mock the dependencies
vi.mock('./nutritionLabelReader', () => ({
  readNutritionLabel: vi.fn(),
}));

vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(),
}));

describe('identifyMealItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect and return nutrition label data when present', async () => {
    const labelData = {
      isNutritionLabel: true,
      productName: 'Coca Cola',
      servingSize: '250ml',
      calories: 105,
      protein: 0,
      fat: 0,
      carbs: 29,
      fibre: 0,
      confidence: 95,
    };

    vi.mocked(readNutritionLabel).mockResolvedValue(labelData);

    const result = await identifyMealItems('https://example.com/label.jpg');

    expect(result.nutritionLabel).toEqual(labelData);
    expect(result.overallDescription).toContain('Coca Cola');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toContain('Coca Cola');
  });

  it('should proceed with food item identification when no nutrition label detected', async () => {
    const labelData = {
      isNutritionLabel: false,
      productName: '',
      servingSize: '',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      confidence: 0,
    };

    vi.mocked(readNutritionLabel).mockResolvedValue(labelData);

    const mealIdentificationResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              overallDescription: 'Full English breakfast',
              items: [
                { description: '2 fried eggs' },
                { description: '2 slices of toast with butter' },
                { description: '3 strips of bacon' },
              ],
              referenceCardDetected: false,
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mealIdentificationResponse as any);

    const result = await identifyMealItems('https://example.com/meal.jpg');

    expect(result.nutritionLabel).toBeUndefined();
    expect(result.overallDescription).toBe('Full English breakfast');
    expect(result.items).toHaveLength(3);
    expect(result.items[0].description).toBe('2 fried eggs');
  });

  it('should skip nutrition label detection if confidence is too low', async () => {
    const labelData = {
      isNutritionLabel: true,
      productName: 'Unknown',
      servingSize: '100g',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      confidence: 30, // Low confidence
    };

    vi.mocked(readNutritionLabel).mockResolvedValue(labelData);

    const mealIdentificationResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              overallDescription: 'Some food items',
              items: [{ description: 'Food item' }],
              referenceCardDetected: false,
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mealIdentificationResponse as any);

    const result = await identifyMealItems('https://example.com/image.jpg');

    // Should proceed with normal food identification, not use the label
    expect(result.overallDescription).toBe('Some food items');
    expect(result.nutritionLabel).toBeUndefined();
  });

  it('should handle nutrition label reading errors gracefully', async () => {
    vi.mocked(readNutritionLabel).mockRejectedValue(new Error('Label reading failed'));

    const mealIdentificationResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              overallDescription: 'Breakfast meal',
              items: [{ description: 'Eggs and toast' }],
              referenceCardDetected: false,
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mealIdentificationResponse as any);

    const result = await identifyMealItems('https://example.com/meal.jpg');

    // Should fall back to normal food identification
    expect(result.overallDescription).toBe('Breakfast meal');
    expect(result.items).toHaveLength(1);
  });

  it('should strip "Approximately" prefix from item descriptions', async () => {
    const labelData = {
      isNutritionLabel: false,
      productName: '',
      servingSize: '',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fibre: 0,
      confidence: 0,
    };

    vi.mocked(readNutritionLabel).mockResolvedValue(labelData);

    const mealIdentificationResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              overallDescription: 'Lunch',
              items: [
                { description: 'Approximately 1 cup of rice' },
                { description: 'Approximately 100g of chicken' },
              ],
              referenceCardDetected: false,
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mealIdentificationResponse as any);

    const result = await identifyMealItems('https://example.com/meal.jpg');

    expect(result.items[0].description).toBe('1 cup of rice');
    expect(result.items[1].description).toBe('100g of chicken');
  });
});
