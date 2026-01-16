import { invokeLLM } from "./_core/llm";

export interface FoodNutrition {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
}

/**
 * Estimate nutrition for a food item based on name and quantity
 * @param foodName - Name of the food item (e.g., "fried eggs", "banana", "chicken breast")
 * @param quantity - Quantity description (e.g., "2", "1 medium", "100g", "1 cup")
 * @returns Nutritional values for the specified food and quantity
 */
export async function estimateFoodNutrition(
  foodName: string,
  quantity: string
): Promise<FoodNutrition> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist AI. Estimate nutritional values for food items based on their name and quantity.

PORTION INTERPRETATION:
- Numbers alone (e.g., "2") should be interpreted as standard serving units for that food
  * "2" eggs = 2 large eggs
  * "3" bananas = 3 medium bananas
  * "2" slices of bread = 2 standard slices
- Accept various quantity formats:
  * Count: "2", "3 pieces"
  * Weight: "100g", "4oz"
  * Volume: "1 cup", "250ml"
  * Size descriptors: "1 medium", "large", "small"
- Use USDA standard serving sizes when quantity is ambiguous
- Be realistic with typical portion sizes

VALIDATION RULES:
1. Calories MUST approximately equal: (protein×4 + carbs×4 + fat×9)
2. Carbs cannot exceed calories÷4
3. Protein cannot exceed calories÷4
4. Fat cannot exceed calories÷9
5. Fiber must be less than total carbs

Provide accurate nutritional estimates based on the food type and specified quantity.`,
        },
        {
          role: "user",
          content: `Please estimate the nutritional values for:

Food: ${foodName}
Quantity: ${quantity}

Provide accurate nutrition data for this specific food item and quantity.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "food_nutrition",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Standardized name of the food item",
              },
              calories: {
                type: "integer",
                description: "Estimated calories for this quantity",
              },
              protein: {
                type: "integer",
                description: "Protein in grams",
              },
              fat: {
                type: "integer",
                description: "Fat in grams",
              },
              carbs: {
                type: "integer",
                description: "Carbohydrates in grams",
              },
              fibre: {
                type: "integer",
                description: "Fiber in grams",
              },
            },
            required: ["name", "calories", "protein", "fat", "carbs", "fibre"],
            additionalProperties: false,
          },
        },
      },
    });

    const message = response.choices[0]?.message;
    if (!message?.content) {
      throw new Error("No response from AI");
    }

    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    const result = JSON.parse(content);
    
    // Validate the nutrition data
    const warnings = validateFoodNutrition(result);
    if (warnings.length > 0) {
      console.warn(`[FoodQuantityEstimation] Validation warnings for "${foodName} (${quantity})":`, warnings);
    }

    return {
      name: result.name,
      calories: result.calories,
      protein: result.protein,
      fat: result.fat,
      carbs: result.carbs,
      fibre: result.fibre,
    };
  } catch (error) {
    console.error("[FoodQuantityEstimation] Error:", error);
    throw new Error(`Failed to estimate nutrition for food: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate food nutritional data for consistency
 */
function validateFoodNutrition(food: FoodNutrition): string[] {
  const warnings: string[] = [];
  
  // Calculate calories from macros
  const calculatedCalories = (food.protein * 4) + (food.carbs * 4) + (food.fat * 9);
  const caloriesDiff = Math.abs(food.calories - calculatedCalories);
  const caloriesDiffPercent = food.calories > 0 ? (caloriesDiff / food.calories) * 100 : 0;
  
  // Allow 20% variance for food estimates
  if (caloriesDiffPercent > 20) {
    warnings.push(`Calorie mismatch: Stated ${food.calories} kcal but macros calculate to ${Math.round(calculatedCalories)} kcal`);
  }
  
  // Check for unrealistic values
  if (food.calories > 0) {
    const maxCarbsFromCalories = food.calories / 4;
    if (food.carbs > maxCarbsFromCalories) {
      warnings.push(`Carbs (${food.carbs}g) exceed maximum possible from calories`);
    }
    
    const maxProteinFromCalories = food.calories / 4;
    if (food.protein > maxProteinFromCalories) {
      warnings.push(`Protein (${food.protein}g) exceeds maximum possible from calories`);
    }
    
    const maxFatFromCalories = food.calories / 9;
    if (food.fat > maxFatFromCalories) {
      warnings.push(`Fat (${food.fat}g) exceeds maximum possible from calories`);
    }
  }
  
  // Fiber should be less than total carbs
  if (food.fibre > food.carbs) {
    warnings.push(`Fiber (${food.fibre}g) cannot exceed total carbs (${food.carbs}g)`);
  }
  
  return warnings;
}
