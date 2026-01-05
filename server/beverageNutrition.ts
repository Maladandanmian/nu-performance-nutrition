import { invokeLLM } from "./_core/llm";

export interface BeverageNutrition {
  drinkType: string;
  volumeMl: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
  confidence: number; // 0-100
  description: string;
}

/**
 * Estimate beverage nutrition using AI based on drink type and volume
 */
export async function estimateBeverageNutrition(
  drinkType: string,
  volumeMl: number
): Promise<BeverageNutrition> {
  const prompt = `You are a nutrition expert. Estimate the nutritional content of the following beverage:

**Beverage:** ${drinkType}
**Volume:** ${volumeMl}ml

Provide accurate nutritional estimates based on typical recipes and serving sizes. Consider:
- Standard recipes (e.g., cappuccino = espresso + steamed milk + foam)
- Common additions (sugar, milk type, syrups)
- Brand variations (if applicable)

For example:
- Cappuccino (250ml) ≈ 120 kcal, 6g protein, 4g fat, 12g carbs
- Coca-Cola (330ml) ≈ 140 kcal, 0g protein, 0g fat, 35g carbs
- Orange juice (250ml) ≈ 110 kcal, 2g protein, 0g fat, 26g carbs
- English breakfast tea with milk (250ml) ≈ 30 kcal, 2g protein, 1g fat, 3g carbs (assuming 30ml whole milk)
- Black tea (250ml) ≈ 2 kcal, 0g protein, 0g fat, 0g carbs
- Water (any volume) = 0 kcal

Return your estimate in JSON format with these exact fields:
{
  "calories": <number>,
  "protein": <number in grams>,
  "fat": <number in grams>,
  "carbs": <number in grams>,
  "fibre": <number in grams>,
  "confidence": <number 0-100>,
  "description": "<brief description of the beverage and assumptions made>"
}

**CRITICAL RULES:**
- Scale nutrition proportionally to the volume provided
- ONLY return zero calories for plain water, black tea, black coffee, or diet/zero-calorie sodas
- ANY drink containing milk, cream, sugar, juice, or other caloric ingredients MUST have calories > 0
- For "tea with milk" or "coffee with milk": use CONSERVATIVE milk estimates
  * 250ml drink → assume 30ml milk (~19 kcal, 1g protein, 1g fat, 1.5g carbs)
  * 350ml drink → assume 40ml milk (~26 kcal, 1.3g protein, 1.3g fat, 2g carbs)
  * Scale proportionally for other volumes
  * Do NOT assume more than 15% of drink volume is milk unless explicitly stated
- For ambiguous drinks (e.g., "coffee"), assume black coffee unless milk/sugar is mentioned
- If you are uncertain about exact values, provide a reasonable estimate rather than returning zeros
- Confidence should reflect certainty (100 for water, 70-80 for common drinks, 50-60 for unusual drinks)

**VALIDATION CHECK:**
Before returning your answer, verify:
- If the drink mentions milk, cream, sugar, honey, or any sweetener → calories MUST be > 0
- If unsure, err on the side of overestimating rather than underestimating`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a nutrition database expert who provides accurate beverage nutrition estimates."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "beverage_nutrition",
        strict: true,
        schema: {
          type: "object",
          properties: {
            calories: { type: "number", description: "Total calories in kcal" },
            protein: { type: "number", description: "Protein in grams" },
            fat: { type: "number", description: "Fat in grams" },
            carbs: { type: "number", description: "Carbohydrates in grams" },
            fibre: { type: "number", description: "Fiber in grams" },
            confidence: { type: "number", description: "Confidence level 0-100" },
            description: { type: "string", description: "Brief description and assumptions" }
          },
          required: ["calories", "protein", "fat", "carbs", "fibre", "confidence", "description"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0].message.content;
  console.log('[beverageNutrition] AI response for', drinkType, ':', content);
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  console.log('[beverageNutrition] Parsed nutrition:', parsed);

  // Validation: Detect suspicious 0-calorie estimates for milk-based drinks
  const lowerDrink = drinkType.toLowerCase();
  const hasMilk = lowerDrink.includes('milk') || lowerDrink.includes('latte') || lowerDrink.includes('cappuccino') || lowerDrink.includes('cream');
  const hasSugar = lowerDrink.includes('sugar') || lowerDrink.includes('sweet') || lowerDrink.includes('honey');
  const isPlainWater = lowerDrink === 'water' || lowerDrink === 'plain water';
  const isBlackTea = (lowerDrink.includes('tea') && !hasMilk && !hasSugar);
  const isBlackCoffee = (lowerDrink.includes('coffee') && !hasMilk && !hasSugar);
  
  if (parsed.calories === 0 && !isPlainWater && !isBlackTea && !isBlackCoffee) {
    console.warn('[beverageNutrition] WARNING: AI returned 0 calories for non-water drink:', drinkType);
    
    // Apply fallback calculation for milk-based drinks
    if (hasMilk) {
      console.log('[beverageNutrition] Applying fallback calculation for milk-based drink');
      // Conservative estimate: 12% of drink volume is milk (typical splash)
      // For 250ml → 30ml milk, for 350ml → 42ml milk
      const milkMl = volumeMl * 0.12;
      // Whole milk: ~0.64 kcal/ml, 0.033g protein/ml, 0.033g fat/ml, 0.05g carbs/ml
      parsed.calories = Math.round(milkMl * 0.64);
      parsed.protein = Math.round(milkMl * 0.033 * 10) / 10;
      parsed.fat = Math.round(milkMl * 0.033 * 10) / 10;
      parsed.carbs = Math.round(milkMl * 0.05 * 10) / 10;
      parsed.fibre = 0;
      parsed.confidence = 60;
      parsed.description = `Fallback estimate: assumed ${Math.round(milkMl)}ml whole milk in ${volumeMl}ml drink (AI returned invalid 0 calories)`;
    }
  }

  return {
    drinkType,
    volumeMl,
    calories: Math.round(parsed.calories),
    protein: Math.round(parsed.protein * 10) / 10, // 1 decimal place
    fat: Math.round(parsed.fat * 10) / 10,
    carbs: Math.round(parsed.carbs * 10) / 10,
    fibre: Math.round(parsed.fibre * 10) / 10,
    confidence: Math.round(parsed.confidence),
    description: parsed.description
  };
}
