import { invokeLLM } from "./_core/llm";

export interface NutritionLabelData {
  productName: string; // Name of the product from the label
  servingSize: string; // Serving size as shown on label (e.g., "1 cup", "100g")
  calories: number;
  protein: number; // grams
  fat: number; // grams
  carbs: number; // grams
  fibre: number; // grams
  confidence: number; // 0-100
  isNutritionLabel: boolean; // Whether the image is actually a nutrition label
}

/**
 * Read and extract nutrition data from a nutrition label image
 * This handles cases where users upload nutrition information labels instead of meal photos
 * @param imageUrl - Public URL of the nutrition label image
 * @returns Extracted nutrition data from the label
 */
export async function readNutritionLabel(imageUrl: string): Promise<NutritionLabelData> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist AI. Your task is to read and extract nutritional information from product nutrition labels.

When you see a nutrition label, extract:
1. Product name (from the label)
2. Serving size (as shown on the label)
3. Nutritional values per serving:
   - Calories
   - Protein (grams)
   - Fat (grams)
   - Carbohydrates (grams)
   - Fiber (grams)

If the image is NOT a nutrition label (e.g., it's a meal photo, a food item, or something else), set isNutritionLabel to false and return default values.

Be accurate and extract the exact values shown on the label. If a value is not shown on the label, use 0.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please read this nutrition label image and extract all nutritional information.

If this is a nutrition label:
- Extract the product name
- Extract the serving size
- Extract all nutritional values (calories, protein, fat, carbs, fiber)
- Set isNutritionLabel to true

If this is NOT a nutrition label (e.g., a meal photo, food item, or other image):
- Set isNutritionLabel to false
- Return default values

Provide the data in the specified JSON format.`,
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
          name: "nutrition_label_data",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isNutritionLabel: {
                type: "boolean",
                description: "Whether the image is actually a nutrition label",
              },
              productName: {
                type: "string",
                description: "Name of the product from the label (empty string if not a nutrition label)",
              },
              servingSize: {
                type: "string",
                description: "Serving size as shown on the label (e.g., '1 cup', '100g')",
              },
              calories: {
                type: "integer",
                description: "Calories per serving",
              },
              protein: {
                type: "integer",
                description: "Protein in grams per serving",
              },
              fat: {
                type: "integer",
                description: "Fat in grams per serving",
              },
              carbs: {
                type: "integer",
                description: "Carbohydrates in grams per serving",
              },
              fibre: {
                type: "integer",
                description: "Fiber in grams per serving",
              },
              confidence: {
                type: "integer",
                description: "Confidence level 0-100 (0 if not a nutrition label)",
              },
            },
            required: ["isNutritionLabel", "productName", "servingSize", "calories", "protein", "fat", "carbs", "fibre", "confidence"],
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
    const labelData = JSON.parse(contentString) as NutritionLabelData;
    
    return labelData;
  } catch (error) {
    console.error("Error reading nutrition label:", error);
    throw new Error(`Failed to read nutrition label: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
