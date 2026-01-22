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
  referenceCardDetected: boolean; // Whether a reference card was detected for portion sizing
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
- Look for a scaling reference object in the image: credit card, business card, or Hong Kong Octopus card
- Credit card: 8.6cm × 5.4cm (signature side up preferred)
- Business card: 9cm × 5cm (standard size)
- Octopus card: 8.6cm × 5.4cm (look for the distinctive figure-8 logo, as cards come in various colors)
- If any reference card is present, use it to calculate the actual scale and portion sizes
- Use the known dimensions to estimate the real size of food items
- If no reference card is visible, estimate portions based on typical serving sizes

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

REFERENCE CARD DETECTION:
- Look carefully for a reference card in the image: credit card, business card, or Octopus card
- If you see ANY of these cards, set referenceCardDetected to true and use the card's known dimensions to calculate accurate portion sizes
- If NO reference card is visible, set referenceCardDetected to false and estimate portions based on typical serving sizes

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
              referenceCardDetected: {
                type: "boolean",
                description: "Whether a reference card (credit card, business card, or Octopus card) was detected in the image for portion size calibration",
              },
            },
            required: ["description", "components", "calories", "protein", "fat", "carbs", "fibre", "confidence", "referenceCardDetected"],
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
 * Calculate nutrition score (1-5) using time-aware contextual approach:
 * - 40% Intrinsic Quality: How healthy is the meal itself?
 * - 60% Contextual Fit: How well does it fit current time + daily progress?
 * 
 * Key insight: A burger at 8am with 0% progress is different from a burger at 8pm with 90% progress.
 * 
 * @param actual - Actual nutritional values from the meal
 * @param goals - Target nutritional goals (daily)
 * @param todaysTotals - Nutrients already consumed today (before this meal)
 * @param mealTime - Time when meal is logged (defaults to now)
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
  } = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 },
  mealTime: Date = new Date()
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
  // PART 2: CONTEXTUAL FIT SCORE (60% weight)
  // ============================================
  
  // Get time of day in Hong Kong timezone
  const hongKongTime = new Date(mealTime.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  const hour = hongKongTime.getHours();
  
  // Determine time period and strictness multiplier
  let timePeriod: 'morning' | 'afternoon' | 'evening' | 'late-night';
  let strictnessMultiplier: number;
  
  if (hour >= 6 && hour < 12) {
    timePeriod = 'morning';
    strictnessMultiplier = 0.7; // More forgiving - full day ahead
  } else if (hour >= 12 && hour < 18) {
    timePeriod = 'afternoon';
    strictnessMultiplier = 1.0; // Normal strictness
  } else if (hour >= 18 && hour < 23) {
    timePeriod = 'evening';
    strictnessMultiplier = 1.5; // Stricter - little time left
  } else {
    timePeriod = 'late-night';
    strictnessMultiplier = 2.0; // Very strict - day is over
  }
  
  // Calculate current progress as % of daily targets
  const currentProgress = {
    calories: todaysTotals.calories / goals.caloriesTarget,
    protein: todaysTotals.protein / goals.proteinTarget,
    fat: todaysTotals.fat / goals.fatTarget,
    carbs: todaysTotals.carbs / goals.carbsTarget,
    fibre: todaysTotals.fibre / goals.fibreTarget,
  };
  
  // Calculate progress AFTER this meal
  const progressAfterMeal = {
    calories: (todaysTotals.calories + actual.calories) / goals.caloriesTarget,
    protein: (todaysTotals.protein + actual.protein) / goals.proteinTarget,
    fat: (todaysTotals.fat + actual.fat) / goals.fatTarget,
    carbs: (todaysTotals.carbs + actual.carbs) / goals.carbsTarget,
    fibre: (todaysTotals.fibre + actual.fibre) / goals.fibreTarget,
  };
  
  // Check for critical nutrient violations (calories and fat are most important)
  const criticalViolations = [
    progressAfterMeal.calories > 1.2 ? 'calories' : null,
    progressAfterMeal.fat > 1.2 ? 'fat' : null,
  ].filter(Boolean);
  
  // Calculate contextual fit score
  let contextScore = 0;
  let contextFactors = 0;
  
  // Factor 1: Budget exhaustion penalty (weighted by time of day)
  const avgProgress = (currentProgress.calories + currentProgress.fat + currentProgress.carbs) / 3;
  
  // Late night is especially strict
  if (avgProgress >= 1.0 && timePeriod === 'late-night') {
    // Already at 100% late at night - any calories are bad
    contextScore += 1; // Very bad - shouldn't be eating
  } else if (avgProgress >= 0.9 && (timePeriod === 'evening' || timePeriod === 'late-night')) {
    // Already at 90%+ in evening/late-night - heavily penalize calorie-dense meals
    const calorieIntensity = actual.calories / 300; // Normalize to typical meal size
    if (calorieIntensity > 2) {
      contextScore += 1; // Very bad - large meal when budget exhausted
    } else if (calorieIntensity > 1) {
      contextScore += 1; // Very bad - medium meal when budget exhausted
    } else {
      contextScore += 4; // Good - light meal when budget exhausted
    }
  } else if (avgProgress >= 0.8 && timePeriod === 'evening') {
    // At 80-90% in evening - penalize heavy meals
    const calorieIntensity = actual.calories / 300;
    if (calorieIntensity > 2) {
      contextScore += 1; // Bad timing for large meal
    } else if (calorieIntensity > 1) {
      contextScore += 2; // Acceptable but not ideal
    } else {
      contextScore += 5; // Good - light meal
    }
  } else if (avgProgress < 0.5 && timePeriod === 'morning') {
    // Morning with lots of budget left - very forgiving
    contextScore += 5; // Any meal is fine in morning with budget
  } else {
    // Normal scoring based on fit
    const remaining = goals.caloriesTarget - todaysTotals.calories;
    if (remaining <= 0) {
      contextScore += 1; // Already over
    } else if (actual.calories <= remaining * 0.4) {
      contextScore += 5; // Well within budget
    } else if (actual.calories <= remaining * 0.7) {
      contextScore += 4; // Good fit
    } else if (actual.calories <= remaining) {
      contextScore += 3; // Uses most of budget
    } else {
      contextScore += 2; // Over budget
    }
  }
  contextFactors++;
  
  // Factor 2: Critical nutrient violations (apply strictness multiplier)
  if (criticalViolations.length > 0) {
    // Penalize based on time of day - more aggressive
    const basePenalty = criticalViolations.length * 3; // 3 points per violation (was 2)
    const adjustedPenalty = basePenalty * strictnessMultiplier;
    contextScore += Math.max(1, 5 - adjustedPenalty); // Heavily penalize violations
  } else {
    // No violations - reward based on how well it fits
    const fatFit = progressAfterMeal.fat <= 1.0 ? 5 : progressAfterMeal.fat <= 1.1 ? 3 : 1;
    const carbFit = progressAfterMeal.carbs <= 1.0 ? 5 : progressAfterMeal.carbs <= 1.1 ? 3 : 1;
    contextScore += (fatFit + carbFit) / 2;
  }
  contextFactors++;
  
  // Factor 3: Additional penalty for calorie and fat overages (most important macros)
  // Going over on calories/fat is worse than going over on protein/carbs/fiber
  if (progressAfterMeal.calories > 1.2 || progressAfterMeal.fat > 1.2) {
    // Severe overage on critical nutrients
    const calorieOverage = Math.max(0, progressAfterMeal.calories - 1.2);
    const fatOverage = Math.max(0, progressAfterMeal.fat - 1.2);
    const totalOverage = calorieOverage + fatOverage;
    
    if (totalOverage > 0.3) {
      contextScore += 1; // Very bad - major calorie/fat overage
    } else if (totalOverage > 0.1) {
      contextScore += 2; // Bad - moderate calorie/fat overage
    } else {
      contextScore += 3; // Slight overage
    }
  } else if (progressAfterMeal.calories > 1.1 || progressAfterMeal.fat > 1.1) {
    // Moderate overage on critical nutrients
    contextScore += 3; // Acceptable but not ideal
  } else {
    // Within limits or under - reward based on protein utilization
    if (currentProgress.protein < 0.8 && actual.protein > 20) {
      contextScore += 5; // Good - high protein when needed
    } else if (currentProgress.protein < 0.9 && actual.protein > 15) {
      contextScore += 4; // Good protein contribution
    } else {
      contextScore += 4; // Good - staying within calorie/fat limits
    }
  }
  contextFactors++;
  
  const avgContextScore = contextScore / contextFactors;
  
  // ============================================
  // FINAL SCORE: Weighted average
  // ============================================
  
  // 40% intrinsic quality, 60% contextual fit (time + progress)
  const finalScore = (avgQualityScore * 0.4) + (avgContextScore * 0.6);
  
  // Round to nearest integer (1-5)
  return Math.max(1, Math.min(5, Math.round(finalScore)));
}
