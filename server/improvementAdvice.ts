import { invokeLLM } from "./_core/llm";

interface MealNutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
}

interface NutritionGoals {
  caloriesTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbsTarget: number;
  fibreTarget: number;
}

interface ScoreBreakdown {
  finalScore: number;
  qualityScore: number;
  progressScore: number;
  proteinRatio: number;
  fiberPer100Cal: number;
  isBalanced: boolean;
  remaining: MealNutrition;
  overBudget: string[];
}

/**
 * Calculate detailed score breakdown for improvement advice
 */
export function calculateScoreBreakdown(
  actual: MealNutrition,
  goals: NutritionGoals,
  todaysTotals: MealNutrition
): ScoreBreakdown {
  // Quality scoring
  let qualityScore = 0;
  let qualityFactors = 0;

  // Protein ratio
  const proteinCalories = actual.protein * 4;
  const proteinRatio = actual.calories > 0 ? proteinCalories / actual.calories : 0;
  if (proteinRatio >= 0.20 && proteinRatio <= 0.35) qualityScore += 5;
  else if (proteinRatio >= 0.15 && proteinRatio < 0.20) qualityScore += 4;
  else if (proteinRatio >= 0.10 && proteinRatio < 0.15) qualityScore += 3;
  else if (proteinRatio >= 0.05 && proteinRatio < 0.10) qualityScore += 2;
  else qualityScore += 1;
  qualityFactors++;

  // Fiber content
  const fiberPer100Cal = actual.calories > 0 ? (actual.fibre / actual.calories) * 100 : 0;
  if (fiberPer100Cal >= 1.5) qualityScore += 5;
  else if (fiberPer100Cal >= 1.0) qualityScore += 4;
  else if (fiberPer100Cal >= 0.5) qualityScore += 3;
  else if (fiberPer100Cal >= 0.25) qualityScore += 2;
  else qualityScore += 1;
  qualityFactors++;

  // Macro balance
  const fatCalories = actual.fat * 9;
  const carbCalories = actual.carbs * 4;
  const totalMacroCalories = proteinCalories + fatCalories + carbCalories;
  
  let isBalanced = false;
  if (totalMacroCalories > 0) {
    const fatRatio = fatCalories / totalMacroCalories;
    const carbRatio = carbCalories / totalMacroCalories;
    
    isBalanced = 
      fatRatio >= 0.15 && fatRatio <= 0.40 &&
      carbRatio >= 0.30 && carbRatio <= 0.70;
    
    if (isBalanced) qualityScore += 5;
    else if (fatRatio < 0.10 || fatRatio > 0.50) qualityScore += 2;
    else if (carbRatio < 0.20 || carbRatio > 0.80) qualityScore += 2;
    else qualityScore += 3;
  } else {
    qualityScore += 3;
  }
  qualityFactors++;

  const avgQualityScore = qualityScore / qualityFactors;

  // Progress scoring
  const remaining = {
    calories: goals.caloriesTarget - todaysTotals.calories,
    protein: goals.proteinTarget - todaysTotals.protein,
    fat: goals.fatTarget - todaysTotals.fat,
    carbs: goals.carbsTarget - todaysTotals.carbs,
    fibre: goals.fibreTarget - todaysTotals.fibre,
  };

  let progressScore = 0;
  let progressFactors = 0;
  const overBudget: string[] = [];

  const nutrients = ['calories', 'protein', 'fat', 'carbs', 'fibre'] as const;
  for (const nutrient of nutrients) {
    const actualValue = actual[nutrient];
    const remainingValue = remaining[nutrient];
    
    if (remainingValue <= 0) {
      progressScore += 1;
      overBudget.push(nutrient);
    } else if (actualValue <= remainingValue * 0.4) {
      progressScore += 5;
    } else if (actualValue <= remainingValue * 0.7) {
      progressScore += 4;
    } else if (actualValue <= remainingValue) {
      progressScore += 3;
    } else if (actualValue <= remainingValue * 1.2) {
      progressScore += 2;
    } else {
      progressScore += 1;
      overBudget.push(nutrient);
    }
    progressFactors++;
  }

  const avgProgressScore = progressScore / progressFactors;
  const finalScore = (avgQualityScore * 0.6) + (avgProgressScore * 0.4);

  return {
    finalScore: Math.max(1, Math.min(5, Math.round(finalScore))),
    qualityScore: avgQualityScore,
    progressScore: avgProgressScore,
    proteinRatio,
    fiberPer100Cal,
    isBalanced,
    remaining,
    overBudget,
  };
}

/**
 * Generate personalized improvement advice using LLM
 */
export async function generateImprovementAdvice(
  mealDescription: string,
  components: Array<{name: string; calories: number; protein: number; fat: number; carbs: number; fibre: number}>,
  actual: MealNutrition,
  goals: NutritionGoals,
  todaysTotals: MealNutrition,
  scoreBreakdown: ScoreBreakdown
): Promise<string> {
  const prompt = `You are a nutrition coach providing personalized advice to help a client improve their meal score.

**Current Meal:**
${mealDescription}

**Food Components:**
${components.map(c => `- ${c.name}: ${c.calories} kcal, ${c.protein}g protein, ${c.fat}g fat, ${c.carbs}g carbs, ${c.fibre}g fiber`).join('\n')}

**Meal Totals:**
- Calories: ${actual.calories} kcal
- Protein: ${actual.protein}g
- Fat: ${actual.fat}g
- Carbs: ${actual.carbs}g
- Fiber: ${actual.fibre}g

**Daily Targets:**
- Calories: ${goals.caloriesTarget} kcal
- Protein: ${goals.proteinTarget}g
- Fat: ${goals.fatTarget}g
- Carbs: ${goals.carbsTarget}g
- Fiber: ${goals.fibreTarget}g

**Already Consumed Today (before this meal):**
- Calories: ${todaysTotals.calories} kcal
- Protein: ${todaysTotals.protein}g
- Fat: ${todaysTotals.fat}g
- Carbs: ${todaysTotals.carbs}g
- Fiber: ${todaysTotals.fibre}g

**Remaining Budget for Today:**
- Calories: ${scoreBreakdown.remaining.calories} kcal
- Protein: ${scoreBreakdown.remaining.protein}g
- Fat: ${scoreBreakdown.remaining.fat}g
- Carbs: ${scoreBreakdown.remaining.carbs}g
- Fiber: ${scoreBreakdown.remaining.fibre}g

**Score Analysis:**
- Overall Score: ${scoreBreakdown.finalScore}/5
- Intrinsic Quality Score: ${scoreBreakdown.qualityScore.toFixed(1)}/5 (60% weight)
- Daily Progress Score: ${scoreBreakdown.progressScore.toFixed(1)}/5 (40% weight)
- Protein Ratio: ${(scoreBreakdown.proteinRatio * 100).toFixed(1)}% (optimal: 20-35%)
- Fiber Density: ${scoreBreakdown.fiberPer100Cal.toFixed(1)}g per 100 kcal (optimal: 1.5+)
- Macro Balance: ${scoreBreakdown.isBalanced ? 'Balanced' : 'Imbalanced'}
${scoreBreakdown.overBudget.length > 0 ? `- Over Budget: ${scoreBreakdown.overBudget.join(', ')}` : ''}

**Your Task:**
Provide 2-3 specific, actionable recommendations to improve this meal's score.

**Guidelines:**
- Use British English spelling (fibre, optimise, etc.)
- Be direct and concise - avoid excessive praise or enthusiasm
- Focus on practical changes: immediate adjustments to this meal, next meal planning, or ingredient swaps
- Consider the client's remaining daily budget
- If quality score is low, focus on protein/fibre improvements
- If progress score is low, focus on portion control
- Use simple numbered list format (1., 2., 3.) - NO asterisks or bold formatting in the advice itself
- Keep total response under 100 words
- Be matter-of-fact, not overly encouraging

Generate the advice now:`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a nutrition coach who provides direct, concise advice in British English. Be factual and practical without excessive praise."
      },
      {
        role: "user",
        content: prompt
      }
    ],
  });

  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : "Unable to generate advice at this time.";
}
