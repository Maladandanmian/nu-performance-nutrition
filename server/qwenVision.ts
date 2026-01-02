import { invokeLLM } from "./_core/llm";

export interface FoodComponent {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
}

export interface NutritionalAnalysis {
  description: string;
  calories: number;
  protein: number; // grams
  fat: number; // grams
  carbs: number; // grams
  fibre: number; // grams
  confidence: number; // 0-100
  components?: FoodComponent[]; // Itemized breakdown of food components
  validationWarnings?: string[]; // Any validation issues detected
}

/**
 * Validate nutritional data for consistency
 * Macros should approximately equal calories: (protein×4 + carbs×4 + fat×9)
 */
function validateNutrition(analysis: NutritionalAnalysis): string[] {
  const warnings: string[] = [];
  
  // Calculate calories from macros
  const calculatedCalories = (analysis.protein * 4) + (analysis.carbs * 4) + (analysis.fat * 9);
  const caloriesDiff = Math.abs(analysis.calories - calculatedCalories);
  const caloriesDiffPercent = (caloriesDiff / analysis.calories) * 100;
  
  // Allow 15% variance (AI estimates aren't perfect)
  if (caloriesDiffPercent > 15) {
    warnings.push(`Calorie mismatch: Stated ${analysis.calories} kcal but macros calculate to ${Math.round(calculatedCalories)} kcal`);
  }
  
  // Check for unrealistic carb values
  const maxCarbsFromCalories = analysis.calories / 4; // All calories from carbs
  if (analysis.carbs > maxCarbsFromCalories) {
    warnings.push(`Carbs (${analysis.carbs}g) exceed maximum possible from calories (${Math.round(maxCarbsFromCalories)}g)`);
  }
  
  // Check for unrealistic protein values
  const maxProteinFromCalories = analysis.calories / 4;
  if (analysis.protein > maxProteinFromCalories) {
    warnings.push(`Protein (${analysis.protein}g) exceed maximum possible from calories (${Math.round(maxProteinFromCalories)}g)`);
  }
  
  // Check for unrealistic fat values
  const maxFatFromCalories = analysis.calories / 9;
  if (analysis.fat > maxFatFromCalories) {
    warnings.push(`Fat (${analysis.fat}g) exceeds maximum possible from calories (${Math.round(maxFatFromCalories)}g)`);
  }
  
  // Fiber should be less than total carbs
  if (analysis.fibre > analysis.carbs) {
    warnings.push(`Fiber (${analysis.fibre}g) cannot exceed total carbs (${analysis.carbs}g)`);
  }
  
  return warnings;
}

/**
 * Analyze a meal image and extract nutritional information with itemized breakdown
 * @param imageUrl - Public URL of the meal image
 * @returns Nutritional analysis with estimated values and component breakdown
 */
export async function analyzeMealImage(imageUrl: string): Promise<NutritionalAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist AI. Analyze food images and provide accurate nutritional estimates.

IMPORTANT: Break down the meal into individual food components for better accuracy, especially for carbohydrates.

PORTION SIZE CALIBRATION:
- Look for a credit card (8.6cm × 5.4cm) in the image as a reference object
- If present, use it to calculate the actual scale and portion sizes
- A standard credit card is 8.6cm wide and 5.4cm tall
- Use this known size to estimate the real dimensions of food items
- If no credit card is visible, estimate portions based on typical serving sizes

For each visible food item, estimate:
- Main protein source (meat, fish, tofu, etc.)
- Carbohydrate sources (rice, noodles, bread, sauces with sugar, dried fruits, etc.)
- Vegetable/greens
- Fats/oils (visible oil, butter, fatty meats, etc.)
- Any sauces, condiments, or toppings

Return your analysis in JSON format with itemized components.

VALIDATION RULES:
1. Total calories MUST approximately equal: (protein×4 + carbs×4 + fat×9)
2. Carbs cannot exceed calories÷4
3. Protein cannot exceed calories÷4
4. Fat cannot exceed calories÷9
5. Fiber must be less than total carbs

Be realistic with portion sizes. If you see a nutrition label, read it carefully and use those exact values.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze this meal or nutrition label and provide detailed nutritional information.

IMPORTANT: If you see a credit card (8.6cm × 5.4cm) in the image, use it as a reference to calculate accurate portion sizes. The credit card's known dimensions will help you estimate the actual size of food items.

Break down the meal into individual food components (e.g., "grilled chicken breast", "steamed rice", "stir-fried vegetables", "teriyaki sauce", etc.) and estimate nutrition for each component separately.

Pay special attention to carbohydrate sources:
- Grains (rice, noodles, bread)
- Sauces and marinades (often contain sugar)
- Dried fruits (raisins, cranberries)
- Starchy vegetables (potatoes, corn)

Then sum up the totals.`,
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
          name: "nutritional_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Brief description of the overall meal",
              },
              components: {
                type: "array",
                description: "Itemized breakdown of each food component",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name of the food component (e.g., 'grilled chicken', 'white rice', 'teriyaki sauce')",
                    },
                    calories: {
                      type: "integer",
                      description: "Calories from this component",
                    },
                    protein: {
                      type: "integer",
                      description: "Protein in grams from this component",
                    },
                    fat: {
                      type: "integer",
                      description: "Fat in grams from this component",
                    },
                    carbs: {
                      type: "integer",
                      description: "Carbohydrates in grams from this component",
                    },
                    fibre: {
                      type: "integer",
                      description: "Fiber in grams from this component",
                    },
                  },
                  required: ["name", "calories", "protein", "fat", "carbs", "fibre"],
                  additionalProperties: false,
                },
              },
              calories: {
                type: "integer",
                description: "Total calories (sum of all components)",
              },
              protein: {
                type: "integer",
                description: "Total protein in grams (sum of all components)",
              },
              fat: {
                type: "integer",
                description: "Total fat in grams (sum of all components)",
              },
              carbs: {
                type: "integer",
                description: "Total carbohydrates in grams (sum of all components)",
              },
              fibre: {
                type: "integer",
                description: "Total fiber in grams (sum of all components)",
              },
              confidence: {
                type: "integer",
                description: "Confidence level 0-100",
              },
            },
            required: ["description", "components", "calories", "protein", "fat", "carbs", "fibre", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Handle both string and array content types
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    const analysis = JSON.parse(contentString) as NutritionalAnalysis;
    
    // Validate the nutritional data
    const warnings = validateNutrition(analysis);
    if (warnings.length > 0) {
      analysis.validationWarnings = warnings;
      console.warn('[Nutrition Validation]', warnings);
    }
    
    return analysis;
  } catch (error) {
    console.error("Error analyzing meal image:", error);
    throw new Error(`Failed to analyze meal image: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Calculate nutrition score (1-5) using hybrid approach:
 * - 60% Intrinsic Quality: How healthy is the meal itself?
 * - 40% Daily Progress: How does it fit within daily targets?
 * 
 * @param actual - Actual nutritional values from the meal
 * @param goals - Target nutritional goals (daily)
 * @param todaysTotals - Nutrients already consumed today (before this meal)
 * @returns Score from 1 (poor) to 5 (excellent)
 */
export function calculateNutritionScore(
  actual: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
  },
  goals: {
    caloriesTarget: number;
    proteinTarget: number;
    fatTarget: number;
    carbsTarget: number;
    fibreTarget: number;
  },
  todaysTotals: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
  } = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
): number {
  // Special case: Zero-calorie beverages (tea, black coffee, water)
  // Return neutral score (3/5) as they have no nutritional impact
  if (actual.calories === 0 || actual.calories < 5) {
    return 3;
  }
  
  // ============================================
  // PART 1: INTRINSIC QUALITY SCORE (60% weight)
  // ============================================
  
  let qualityScore = 0;
  let qualityFactors = 0;
  
  // Factor 1: Protein ratio (protein calories / total calories)
  // Good range: 20-35% of calories from protein
  const proteinCalories = actual.protein * 4;
  const proteinRatio = actual.calories > 0 ? proteinCalories / actual.calories : 0;
  if (proteinRatio >= 0.20 && proteinRatio <= 0.35) {
    qualityScore += 5; // Excellent protein ratio
  } else if (proteinRatio >= 0.15 && proteinRatio < 0.20) {
    qualityScore += 4; // Good
  } else if (proteinRatio >= 0.10 && proteinRatio < 0.15) {
    qualityScore += 3; // Acceptable
  } else if (proteinRatio >= 0.05 && proteinRatio < 0.10) {
    qualityScore += 2; // Low
  } else {
    qualityScore += 1; // Very low or excessive
  }
  qualityFactors++;
  
  // Factor 2: Fiber content (grams per 100 calories)
  // Good: 1.5+ grams per 100 kcal
  const fiberPer100Cal = actual.calories > 0 ? (actual.fibre / actual.calories) * 100 : 0;
  if (fiberPer100Cal >= 1.5) {
    qualityScore += 5; // Excellent fiber
  } else if (fiberPer100Cal >= 1.0) {
    qualityScore += 4; // Good
  } else if (fiberPer100Cal >= 0.5) {
    qualityScore += 3; // Acceptable
  } else if (fiberPer100Cal >= 0.25) {
    qualityScore += 2; // Low
  } else {
    qualityScore += 1; // Very low
  }
  qualityFactors++;
  
  // Factor 3: Macro balance (not extreme in any direction)
  // Check if any macro is extremely high or low
  const fatCalories = actual.fat * 9;
  const carbCalories = actual.carbs * 4;
  const totalMacroCalories = proteinCalories + fatCalories + carbCalories;
  
  if (totalMacroCalories > 0) {
    const fatRatio = fatCalories / totalMacroCalories;
    const carbRatio = carbCalories / totalMacroCalories;
    
    // Balanced: 20-35% fat, 40-65% carbs, rest protein
    const isBalanced = 
      fatRatio >= 0.15 && fatRatio <= 0.40 &&
      carbRatio >= 0.30 && carbRatio <= 0.70;
    
    if (isBalanced) {
      qualityScore += 5; // Well balanced
    } else if (fatRatio < 0.10 || fatRatio > 0.50) {
      qualityScore += 2; // Extreme fat ratio
    } else if (carbRatio < 0.20 || carbRatio > 0.80) {
      qualityScore += 2; // Extreme carb ratio
    } else {
      qualityScore += 3; // Somewhat balanced
    }
  } else {
    qualityScore += 3; // Neutral if can't calculate
  }
  qualityFactors++;
  
  // Calculate average quality score (1-5)
  const avgQualityScore = qualityScore / qualityFactors;
  
  // ============================================
  // PART 2: DAILY PROGRESS SCORE (40% weight)
  // ============================================
  
  // Calculate remaining budget for today
  const remaining = {
    calories: goals.caloriesTarget - todaysTotals.calories,
    protein: goals.proteinTarget - todaysTotals.protein,
    fat: goals.fatTarget - todaysTotals.fat,
    carbs: goals.carbsTarget - todaysTotals.carbs,
    fibre: goals.fibreTarget - todaysTotals.fibre,
  };
  
  // Calculate how well this meal fits the remaining budget
  let progressScore = 0;
  let progressFactors = 0;
  
  // For each nutrient, score based on fit
  const nutrients = ['calories', 'protein', 'fat', 'carbs', 'fibre'] as const;
  
  for (const nutrient of nutrients) {
    const actualValue = actual[nutrient];
    const remainingValue = remaining[nutrient];
    const targetValue = goals[`${nutrient}Target` as keyof typeof goals];
    
    if (remainingValue <= 0) {
      // Already over target - any more is bad
      progressScore += 1;
    } else if (actualValue <= remainingValue * 0.4) {
      // Well within budget (using <40% of remaining)
      progressScore += 5;
    } else if (actualValue <= remainingValue * 0.7) {
      // Good fit (using 40-70% of remaining)
      progressScore += 4;
    } else if (actualValue <= remainingValue) {
      // Fits but uses most of budget (70-100%)
      progressScore += 3;
    } else if (actualValue <= remainingValue * 1.2) {
      // Slightly over remaining budget (100-120%)
      progressScore += 2;
    } else {
      // Significantly over budget (>120%)
      progressScore += 1;
    }
    progressFactors++;
  }
  
  const avgProgressScore = progressScore / progressFactors;
  
  // ============================================
  // FINAL SCORE: Weighted average
  // ============================================
  
  const finalScore = (avgQualityScore * 0.6) + (avgProgressScore * 0.4);
  
  // Round to nearest integer (1-5)
  return Math.max(1, Math.min(5, Math.round(finalScore)));
}
