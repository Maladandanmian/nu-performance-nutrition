import { invokeLLM } from "./_core/llm";

export interface FoodComponent {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
}

export interface NutritionalAnalysisFromItems {
  description: string; // Final meal description based on user-confirmed items
  components: FoodComponent[]; // Nutrition breakdown for each item
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
  confidence: number;
}

/**
 * Analyze nutritional content from a list of food item descriptions
 * This is Step 4 of the new meal logging flow
 * @param itemDescriptions - Array of food item descriptions (e.g., ["2 fried eggs", "1 slice toast with butter"])
 * @param imageUrl - Optional image URL for visual reference
 * @returns Nutritional analysis with component breakdown
 */
export async function analyzeMealNutrition(
  itemDescriptions: string[],
  imageUrl?: string
): Promise<NutritionalAnalysisFromItems> {
  try {
    const userContent: any[] = [
      {
        type: "text",
        text: `Please analyze the nutritional content of these food items:

${itemDescriptions.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}

For each item, estimate:
- Calories
- Protein (grams)
- Fat (grams)
- Carbohydrates (grams)
- Fiber (grams)

Then provide totals for the entire meal.

VALIDATION RULES:
1. Total calories MUST approximately equal: (protein×4 + carbs×4 + fat×9)
2. Carbs cannot exceed calories÷4
3. Protein cannot exceed calories÷4
4. Fat cannot exceed calories÷9
5. Fiber must be less than total carbs

Be realistic with portion sizes and nutritional values.`,
      },
    ];

    // Add image if provided for visual reference
    if (imageUrl) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      });
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist AI. Analyze food descriptions and provide accurate nutritional estimates.

For each food item, estimate nutrition based on:
- Typical serving sizes
- Preparation methods (fried, grilled, steamed, etc.)
- Ingredient specifications (whole milk vs skim, white rice vs brown, etc.)

Break down each item into its nutritional components and sum up the totals.`,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "nutritional_analysis_from_items",
          strict: true,
          schema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Brief description of the overall meal based on the provided items",
              },
              components: {
                type: "array",
                description: "Nutritional breakdown for each food item",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name/description of the food item",
                    },
                    calories: {
                      type: "integer",
                      description: "Calories from this item",
                    },
                    protein: {
                      type: "integer",
                      description: "Protein in grams from this item",
                    },
                    fat: {
                      type: "integer",
                      description: "Fat in grams from this item",
                    },
                    carbs: {
                      type: "integer",
                      description: "Carbohydrates in grams from this item",
                    },
                    fibre: {
                      type: "integer",
                      description: "Fiber in grams from this item",
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
    const analysis = JSON.parse(contentString) as NutritionalAnalysisFromItems;
    
    return analysis;
  } catch (error) {
    console.error("Error analyzing meal nutrition:", error);
    throw new Error(`Failed to analyze meal nutrition: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
