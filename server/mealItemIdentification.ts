import { invokeLLM } from "./_core/llm";
import { readNutritionLabel, NutritionLabelData } from "./nutritionLabelReader";

export interface MealItem {
  description: string; // e.g., "2 fried eggs", "1 slice of toast with butter"
}

export interface MealItemsIdentification {
  overallDescription: string; // Brief description of the overall meal
  items: MealItem[]; // List of identified food items
  referenceCardDetected: boolean; // Whether a reference card was detected
  nutritionLabel?: NutritionLabelData; // If the image is a nutrition label, include the extracted data
}

/**
 * Identify food items in a meal image without nutritional analysis
 * This is Step 2 of the new meal logging flow
 * Also detects if the image is a nutrition label and extracts nutrition data
 * @param imageUrl - Public URL of the meal image
 * @returns List of identified meal items with descriptions, or nutrition label data if detected
 */
export async function identifyMealItems(imageUrl: string): Promise<MealItemsIdentification> {
  // First, check if this is a nutrition label
  try {
    const labelData = await readNutritionLabel(imageUrl);
    if (labelData.isNutritionLabel && labelData.confidence > 50) {
      // This is a nutrition label - return it with the extracted data
      return {
        overallDescription: `Nutrition label for ${labelData.productName}`,
        items: [
          {
            description: `${labelData.productName} (${labelData.servingSize})`
          }
        ],
        referenceCardDetected: false,
        nutritionLabel: labelData
      };
    }
  } catch (labelError) {
    // If nutrition label reading fails, continue with normal food item identification
    console.log("Nutrition label detection skipped, proceeding with food item identification");
  }
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional nutritionist AI. Your task is to identify and describe food items in meal images.

PORTION SIZE CALIBRATION:
- Look for a scaling reference object in the image: credit card, business card, or Hong Kong Octopus card
- Credit card: 8.6cm × 5.4cm (signature side up preferred)
- Business card: 9cm × 5cm (standard size)
- Octopus card: 8.6cm × 5.4cm (look for the distinctive figure-8 logo, as cards come in various colors)
- If any reference card is present, use it to estimate portion sizes accurately
- If no reference card is visible, estimate portions based on typical serving sizes

Your job is to:
1. Identify each visible food item in the image
2. Describe each item with estimated quantity (e.g., "2 fried eggs", "1 cup of rice", "3 slices of bacon")
3. Include preparation methods when visible (e.g., "fried", "grilled", "steamed")
4. Be specific about ingredients when possible (e.g., "white rice" vs "brown rice", "whole milk" vs "skim milk")

DO NOT provide nutritional information yet - only identify and describe the items.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please identify all food items in this meal image and describe each one with estimated quantities.

REFERENCE CARD DETECTION:
- Look carefully for a reference card in the image: credit card, business card, or Octopus card
- If you see ANY of these cards, set referenceCardDetected to true and use the card's known dimensions to estimate portion sizes
- If NO reference card is visible, set referenceCardDetected to false and estimate portions based on typical serving sizes

Provide:
1. A brief overall description of the meal
2. A list of individual food items with quantities and preparation methods

Example format:
- "2 fried eggs"
- "2 slices of whole wheat toast with butter"
- "1/2 cup of baked beans"
- "3 strips of bacon"`,
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
          name: "meal_items_identification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallDescription: {
                type: "string",
                description: "Brief description of the overall meal (e.g., 'Full English breakfast with eggs, toast, and beans')",
              },
              items: {
                type: "array",
                description: "List of identified food items with quantities",
                items: {
                  type: "object",
                  properties: {
                    description: {
                      type: "string",
                      description: "Description of the food item with quantity and preparation method (e.g., '2 fried eggs', '1 slice of toast with butter')",
                    },
                  },
                  required: ["description"],
                  additionalProperties: false,
                },
              },
              referenceCardDetected: {
                type: "boolean",
                description: "Whether a reference card (credit card, business card, or Octopus card) was detected in the image for portion size calibration",
              },
            },
            required: ["overallDescription", "items", "referenceCardDetected"],
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
    const identification = JSON.parse(contentString) as MealItemsIdentification;
    
    // Remove "Approximately" prefix from item descriptions (since section header already says "Approx.")
    identification.items = identification.items.map(item => ({
      ...item,
      description: item.description.replace(/^Approximately\s+/i, '')
    }));
    
    return identification;
  } catch (error) {
    console.error("Error identifying meal items:", error);
    throw new Error(`Failed to identify meal items: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
