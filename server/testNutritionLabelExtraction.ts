/**
 * Test script to verify nutrition label extraction fix
 * Run with: node --import tsx server/testNutritionLabelExtraction.ts
 */

import { readFileSync } from "fs";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

async function testNutritionLabelExtraction() {
  console.log("Testing nutrition label extraction with protein powder label...\n");

  // Read the uploaded image
  const imagePath = "/home/ubuntu/upload/4E21F8A3-255D-4A1C-83A3-53CA67DB94F1.jpeg";
  const imageBuffer = readFileSync(imagePath);
  
  // Upload to S3
  const imageKey = `test-nutrition-labels/protein-powder-${Date.now()}.jpg`;
  const { url: imageUrl } = await storagePut(imageKey, imageBuffer, "image/jpeg");
  console.log(`Image uploaded to: ${imageUrl}\n`);

  // Extract nutrition data using the fixed prompt
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a nutrition label reader. Extract nutrition information from the label image and return it in JSON format. Be precise with numbers. Support Chinese and English labels."
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl }
          },
          {
            type: "text",
            text: `Extract the following from this nutrition label:

1. **Reference Serving**: The serving size that nutrition values on the label are based on
   - IMPORTANT: Always extract the weight/volume in grams or ml, NOT a count like "1 serving"
   - Example: If label says "Per Serving (35.5g)", extract referenceSize=35.5, referenceUnit="g"
   - Example: If label says "Per 100g", extract referenceSize=100, referenceUnit="g"
   - Example: If label says "Per 100ml", extract referenceSize=100, referenceUnit="ml"
   - referenceSize: number (the gram/ml amount, e.g., 35.5, 100)
   - referenceUnit: string (must be "g" or "ml", never "serving")

2. **Actual Serving**: The recommended serving size per consumption (if different from reference)
   - Only fill this if the label shows a DIFFERENT serving size than the reference
   - Example: Label shows "Per 100g" but recommends "1 sachet (3.5g)" → actualServingSize=3.5
   - Example: Label shows "Per Serving (35.5g)" with no other serving → actualServingSize=35.5 (same as reference)
   - actualServingSize: number (e.g., 3.5, 35.5)
   - actualServingUnit: string (e.g., "g", "ml")
   - actualServingDescription: string (e.g., "per sachet", "1 scoop", "1 rounded scoop")
   - If not found or same as reference, set actualServingSize = referenceSize

3. **Nutrition per reference serving**:
   - calories (kcal/kJ - convert kJ to kcal by dividing by 4.184)
   - protein (g)
   - carbs (g - total carbohydrates, or 碳水化合物)
   - fat (g - total fat, or 脂肪)
   - fiber (g - dietary fiber, or 膳食纤维, set to 0 if not available)

4. **Product name**: The name of the product (e.g., "Qing Yuansu", "轻元素")

5. **Ingredients**: List the main ingredients/components visible on the label
   - Extract up to 10 key ingredients
   - Include percentages if shown (e.g., "Barley Grass Powder (45%)")
   - For Chinese labels, translate to English

Return as JSON.`
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "nutrition_label",
        strict: true,
        schema: {
          type: "object",
          properties: {
            referenceSize: { type: "number", description: "The reference serving size number (e.g., 100 for per 100g)" },
            referenceUnit: { type: "string", description: "The unit of the reference serving (g, ml, serving, etc.)" },
            actualServingSize: { type: "number", description: "The actual serving size per consumption" },
            actualServingUnit: { type: "string", description: "The unit of the actual serving (g, ml, etc.)" },
            actualServingDescription: { type: "string", description: "Description of actual serving (e.g., 'per sachet', '1 scoop')" },
            calories: { type: "number", description: "Calories per reference serving" },
            protein: { type: "number", description: "Protein in grams per reference serving" },
            carbs: { type: "number", description: "Carbohydrates in grams per reference serving" },
            fat: { type: "number", description: "Fat in grams per reference serving" },
            fiber: { type: "number", description: "Fiber in grams per reference serving, 0 if not available" },
            productName: { type: "string", description: "Name of the product" },
            ingredients: {
              type: "array",
              description: "List of main ingredients",
              items: { type: "string" }
            },
          },
          required: ["referenceSize", "referenceUnit", "actualServingSize", "actualServingUnit", "actualServingDescription", "calories", "protein", "carbs", "fat", "fiber", "productName", "ingredients"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const nutritionData = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

  console.log("Extracted nutrition data:");
  console.log(JSON.stringify(nutritionData, null, 2));
  console.log("\n");

  // Calculate nutrition per actual serving
  const multiplier = nutritionData.actualServingSize / nutritionData.referenceSize;
  const perServingNutrition = {
    calories: Math.round(nutritionData.calories * multiplier),
    protein: Math.round(nutritionData.protein * multiplier * 10) / 10,
    fat: Math.round(nutritionData.fat * multiplier * 10) / 10,
    carbs: Math.round(nutritionData.carbs * multiplier * 10) / 10,
    fiber: Math.round(nutritionData.fiber * multiplier * 10) / 10,
  };

  console.log("Calculated nutrition per serving:");
  console.log(`Multiplier: ${multiplier} (${nutritionData.actualServingSize}g / ${nutritionData.referenceSize}g)`);
  console.log(`Calories: ${perServingNutrition.calories} kcal`);
  console.log(`Protein: ${perServingNutrition.protein}g`);
  console.log(`Carbs: ${perServingNutrition.carbs}g`);
  console.log(`Fat: ${perServingNutrition.fat}g`);
  console.log(`Fiber: ${perServingNutrition.fiber}g`);
  console.log("\n");

  // Verify against expected values
  console.log("Expected values from label:");
  console.log("Calories: 100 kcal");
  console.log("Protein: 25g");
  console.log("Carbs: 1g");
  console.log("Fat: 0g");
  console.log("Fiber: 0g");
  console.log("\n");

  const isCorrect = 
    perServingNutrition.calories === 100 &&
    perServingNutrition.protein === 25 &&
    perServingNutrition.carbs === 1 &&
    perServingNutrition.fat === 0 &&
    perServingNutrition.fiber === 0;

  if (isCorrect) {
    console.log("✅ TEST PASSED! Nutrition values match the label.");
  } else {
    console.log("❌ TEST FAILED! Nutrition values don't match the label.");
  }
}

testNutritionLabelExtraction().catch(console.error);
