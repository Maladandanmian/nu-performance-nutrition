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

**Important:**
- Scale nutrition proportionally to the volume provided
- For water or zero-calorie drinks, return all zeros
- For ambiguous drinks (e.g., "coffee"), assume black coffee unless specified
- If drink includes milk/sugar, mention assumptions in description
- Confidence should reflect certainty (100 for water, 70-80 for common drinks, 50-60 for unusual drinks)`;

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
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;

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
