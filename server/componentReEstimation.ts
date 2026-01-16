import { invokeLLM } from "./_core/llm";

export interface ComponentNutrition {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
}

/**
 * Re-estimate nutrition for a single food component based on updated description
 * Uses the original meal image for context and portion size estimation
 * @param componentName - Updated food component name/description (e.g., "oat milk" instead of "full-fat milk")
 * @param imageUrl - Original meal image URL for visual context and portion estimation
 * @returns Updated nutritional values for the component
 */
export async function reEstimateComponentNutrition(
  componentName: string,
  imageUrl: string
): Promise<ComponentNutrition> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist AI. Re-estimate nutritional values for a specific food component based on its updated description and the visual context from the meal image.

PORTION SIZE ESTIMATION:
- Look at the image to estimate the portion size of the food component
- Look for reference objects like credit cards (8.6cm × 5.4cm) for scale
- Consider typical serving sizes if no reference is available
- Use visual cues like bowl size, plate coverage, liquid levels, etc.

VALIDATION RULES:
1. Calories MUST approximately equal: (protein×4 + carbs×4 + fat×9)
2. Carbs cannot exceed calories÷4
3. Protein cannot exceed calories÷4
4. Fat cannot exceed calories÷9
5. Fiber must be less than total carbs

Be realistic and accurate with nutritional values for the specific food type and estimated portion.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please estimate the nutritional values for this food component: "${componentName}"

Use the image to estimate the portion size. Look for visual cues like:
- Container size (bowl, cup, glass)
- Comparison to other items in the image
- Reference objects (credit card, utensils)
- Liquid levels for beverages
- Plate coverage for solid foods

Provide accurate nutritional estimates based on the food type and visible portion size.`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "component_nutrition",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the food component",
              },
              calories: {
                type: "integer",
                description: "Estimated calories for this portion",
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
    const warnings = validateComponentNutrition(result);
    if (warnings.length > 0) {
      console.warn(`[ComponentReEstimation] Validation warnings for "${componentName}":`, warnings);
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
    console.error("[ComponentReEstimation] Error:", error);
    throw new Error(`Failed to re-estimate nutrition for component: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate component nutritional data for consistency
 */
function validateComponentNutrition(component: ComponentNutrition): string[] {
  const warnings: string[] = [];
  
  // Calculate calories from macros
  const calculatedCalories = (component.protein * 4) + (component.carbs * 4) + (component.fat * 9);
  const caloriesDiff = Math.abs(component.calories - calculatedCalories);
  const caloriesDiffPercent = component.calories > 0 ? (caloriesDiff / component.calories) * 100 : 0;
  
  // Allow 20% variance for single components (more lenient than full meals)
  if (caloriesDiffPercent > 20) {
    warnings.push(`Calorie mismatch: Stated ${component.calories} kcal but macros calculate to ${Math.round(calculatedCalories)} kcal`);
  }
  
  // Check for unrealistic values
  if (component.calories > 0) {
    const maxCarbsFromCalories = component.calories / 4;
    if (component.carbs > maxCarbsFromCalories) {
      warnings.push(`Carbs (${component.carbs}g) exceed maximum possible from calories`);
    }
    
    const maxProteinFromCalories = component.calories / 4;
    if (component.protein > maxProteinFromCalories) {
      warnings.push(`Protein (${component.protein}g) exceeds maximum possible from calories`);
    }
    
    const maxFatFromCalories = component.calories / 9;
    if (component.fat > maxFatFromCalories) {
      warnings.push(`Fat (${component.fat}g) exceeds maximum possible from calories`);
    }
  }
  
  // Fiber should be less than total carbs
  if (component.fibre > component.carbs) {
    warnings.push(`Fiber (${component.fibre}g) cannot exceed total carbs (${component.carbs}g)`);
  }
  
  return warnings;
}
