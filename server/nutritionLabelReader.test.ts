import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readNutritionLabel } from './nutritionLabelReader';
import { invokeLLM } from './_core/llm';

// Mock the invokeLLM function
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(),
}));

describe('readNutritionLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract nutrition data from a valid nutrition label', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              isNutritionLabel: true,
              productName: 'Coca Cola',
              servingSize: '250ml',
              calories: 105,
              protein: 0,
              fat: 0,
              carbs: 29,
              fibre: 0,
              confidence: 95,
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

    const result = await readNutritionLabel('https://example.com/label.jpg');

    expect(result).toEqual({
      isNutritionLabel: true,
      productName: 'Coca Cola',
      servingSize: '250ml',
      calories: 105,
      protein: 0,
      fat: 0,
      carbs: 29,
      fibre: 0,
      confidence: 95,
    });

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.any(Array),
        response_format: expect.any(Object),
      })
    );
  });

  it('should return isNutritionLabel=false for non-label images', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              isNutritionLabel: false,
              productName: '',
              servingSize: '',
              calories: 0,
              protein: 0,
              fat: 0,
              carbs: 0,
              fibre: 0,
              confidence: 0,
            }),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

    const result = await readNutritionLabel('https://example.com/meal.jpg');

    expect(result.isNutritionLabel).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should handle string content response from LLM', async () => {
    const labelData = {
      isNutritionLabel: true,
      productName: 'Orange Juice',
      servingSize: '200ml',
      calories: 86,
      protein: 1,
      fat: 0,
      carbs: 21,
      fibre: 0,
      confidence: 88,
    };

    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify(labelData),
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

    const result = await readNutritionLabel('https://example.com/oj.jpg');

    expect(result).toEqual(labelData);
  });

  it('should throw error when LLM returns no content', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

    await expect(readNutritionLabel('https://example.com/label.jpg')).rejects.toThrow(
      'Failed to read nutrition label'
    );
  });

  it('should throw error when LLM call fails', async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error('LLM service unavailable'));

    await expect(readNutritionLabel('https://example.com/label.jpg')).rejects.toThrow(
      'Failed to read nutrition label'
    );
  });
});
