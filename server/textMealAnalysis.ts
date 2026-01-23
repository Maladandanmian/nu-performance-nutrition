import { invokeLLM } from "./_core/llm";

export interface TextMealItem {
  description: string; // e.g., "1 cup white rice", "4 oz hamachi (yellowtail)"
}

export interface TextMealAnalysis {
  overallDescription: string; // Brief description of the meal
  items: TextMealItem[]; // List of identified food components
}

/**
 * Analyze a meal from text description and break it down into components
 * This allows users to log meals from memory without photos
 * @param mealDescription - User's text description of the meal (e.g., "hamachi poke bowl with sesame sauce")
 * @returns List of identified meal components with estimated quantities
 */
export async function analyzeTextMeal(mealDescription: string): Promise<TextMealAnalysis> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist AI. Your task is to analyze meal descriptions provided by users and break them down into individual food components with estimated quantities.

When a user describes a meal from memory (e.g., "hamachi poke bowl with sesame sauce" or "french toast"), you should:
1. Identify all likely food components in the dish
2. Provide reasonable quantity estimates based on typical restaurant/home serving sizes
3. Include preparation methods when relevant (e.g., "grilled", "fried", "raw")
4. Be specific about ingredients (e.g., "white rice" vs "brown rice", "soy sauce" vs "sesame sauce")
5. Break down complex dishes into their components (e.g., poke bowl → rice, fish, sauce, toppings)

IMPORTANT: These are estimates based on typical servings. The user will have a chance to review and edit the components afterward.

DO NOT provide nutritional information yet - only identify and describe the components with quantities.`,
        },
        {
          role: "user",
          content: `Please analyze this meal description and break it down into individual food components with estimated quantities:

"${mealDescription}"

Provide:
1. A brief overall description of the meal (cleaned up version of user's input)
2. A list of individual food components with estimated quantities

Example for "hamachi poke bowl with sesame sauce":
- Overall: "Hamachi (yellowtail) poke bowl with sesame sauce"
- Components:
  * "1 cup white rice"
  * "4 oz hamachi (yellowtail), raw"
  * "2 tbsp sesame sauce"
  * "1/4 cup edamame"
  * "2 tbsp seaweed salad"
  * "1 tsp sesame seeds"

Example for "french toast":
- Overall: "French toast breakfast"
- Components:
  * "2 slices french toast"
  * "2 tbsp maple syrup"
  * "1 tbsp butter"
  * "1/4 cup berries"`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "text_meal_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallDescription: {
                type: "string",
                description: "Brief cleaned-up description of the meal based on user's input",
              },
              items: {
                type: "array",
                description: "List of identified food components with estimated quantities",
                items: {
                  type: "object",
                  properties: {
                    description: {
                      type: "string",
                      description: "Description of the food component with quantity (e.g., '1 cup white rice', '4 oz hamachi, raw')",
                    },
                  },
                  required: ["description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["overallDescription", "items"],
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
    const analysis = JSON.parse(contentString) as TextMealAnalysis;
    
    // Remove "Approximately" prefix from item descriptions (since section header already says "Approx.")
    analysis.items = analysis.items.map(item => ({
      ...item,
      description: item.description.replace(/^Approximately\s+/i, '')
    }));
    
    return analysis;
  } catch (error) {
    console.error("Error analyzing text meal:", error);
    throw new Error(`Failed to analyze meal description: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
