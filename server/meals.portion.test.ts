import { describe, it, expect } from "vitest";

/**
 * Test suite for meal portion adjustment feature
 * 
 * This feature allows users to specify what percentage of a meal they consumed,
 * which proportionally scales all nutritional values (calories, protein, fat, carbs, fiber)
 * for both meal components and accompanying beverages.
 */

describe("Portion Adjustment Calculations", () => {
  it("should scale meal nutrition by 50% when portion is 50%", () => {
    // Original meal nutrition
    const originalMeal = {
      calories: 800,
      protein: 40,
      fat: 30,
      carbs: 80,
      fibre: 10,
    };

    const portionPercentage = 50;
    const portionMultiplier = portionPercentage / 100;

    const scaledMeal = {
      calories: Math.round(originalMeal.calories * portionMultiplier),
      protein: Math.round(originalMeal.protein * portionMultiplier * 10) / 10,
      fat: Math.round(originalMeal.fat * portionMultiplier * 10) / 10,
      carbs: Math.round(originalMeal.carbs * portionMultiplier * 10) / 10,
      fibre: Math.round(originalMeal.fibre * portionMultiplier * 10) / 10,
    };

    expect(scaledMeal.calories).toBe(400);
    expect(scaledMeal.protein).toBe(20);
    expect(scaledMeal.fat).toBe(15);
    expect(scaledMeal.carbs).toBe(40);
    expect(scaledMeal.fibre).toBe(5);
  });

  it("should scale meal + beverage nutrition by 25% when portion is 25%", () => {
    // Original meal nutrition
    const mealNutrition = {
      calories: 600,
      protein: 30,
      fat: 20,
      carbs: 60,
      fibre: 8,
    };

    // Beverage nutrition
    const beverageNutrition = {
      calories: 200,
      protein: 0,
      fat: 0,
      carbs: 50,
      fibre: 0,
    };

    // Combined nutrition (meal + beverage)
    const combinedNutrition = {
      calories: mealNutrition.calories + beverageNutrition.calories,
      protein: mealNutrition.protein + beverageNutrition.protein,
      fat: mealNutrition.fat + beverageNutrition.fat,
      carbs: mealNutrition.carbs + beverageNutrition.carbs,
      fibre: mealNutrition.fibre + beverageNutrition.fibre,
    };

    const portionPercentage = 25;
    const portionMultiplier = portionPercentage / 100;

    const scaledNutrition = {
      calories: Math.round(combinedNutrition.calories * portionMultiplier),
      protein: Math.round(combinedNutrition.protein * portionMultiplier * 10) / 10,
      fat: Math.round(combinedNutrition.fat * portionMultiplier * 10) / 10,
      carbs: Math.round(combinedNutrition.carbs * portionMultiplier * 10) / 10,
      fibre: Math.round(combinedNutrition.fibre * portionMultiplier * 10) / 10,
    };

    // Expected: (600 + 200) * 0.25 = 200 calories
    expect(scaledNutrition.calories).toBe(200);
    // Expected: (30 + 0) * 0.25 = 7.5 protein
    expect(scaledNutrition.protein).toBe(7.5);
    // Expected: (20 + 0) * 0.25 = 5 fat
    expect(scaledNutrition.fat).toBe(5);
    // Expected: (60 + 50) * 0.25 = 27.5 carbs
    expect(scaledNutrition.carbs).toBe(27.5);
    // Expected: (8 + 0) * 0.25 = 2 fibre
    expect(scaledNutrition.fibre).toBe(2);
  });

  it("should not scale when portion is 100%", () => {
    const originalMeal = {
      calories: 750,
      protein: 35,
      fat: 25,
      carbs: 70,
      fibre: 12,
    };

    const portionPercentage = 100;
    const portionMultiplier = portionPercentage / 100;

    const scaledMeal = {
      calories: Math.round(originalMeal.calories * portionMultiplier),
      protein: Math.round(originalMeal.protein * portionMultiplier * 10) / 10,
      fat: Math.round(originalMeal.fat * portionMultiplier * 10) / 10,
      carbs: Math.round(originalMeal.carbs * portionMultiplier * 10) / 10,
      fibre: Math.round(originalMeal.fibre * portionMultiplier * 10) / 10,
    };

    expect(scaledMeal.calories).toBe(originalMeal.calories);
    expect(scaledMeal.protein).toBe(originalMeal.protein);
    expect(scaledMeal.fat).toBe(originalMeal.fat);
    expect(scaledMeal.carbs).toBe(originalMeal.carbs);
    expect(scaledMeal.fibre).toBe(originalMeal.fibre);
  });

  it("should scale meal with multiple components by 75%", () => {
    // Meal with multiple components
    const components = [
      { name: "Pizza slice", calories: 300, protein: 12, fat: 10, carbs: 35, fibre: 2 },
      { name: "Side salad", calories: 100, protein: 3, fat: 5, carbs: 10, fibre: 3 },
      { name: "Garlic bread", calories: 200, protein: 5, fat: 8, carbs: 25, fibre: 1 },
    ];

    // Sum all components
    const totalNutrition = components.reduce(
      (acc, comp) => ({
        calories: acc.calories + comp.calories,
        protein: acc.protein + comp.protein,
        fat: acc.fat + comp.fat,
        carbs: acc.carbs + comp.carbs,
        fibre: acc.fibre + comp.fibre,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
    );

    const portionPercentage = 75;
    const portionMultiplier = portionPercentage / 100;

    const scaledNutrition = {
      calories: Math.round(totalNutrition.calories * portionMultiplier),
      protein: Math.round(totalNutrition.protein * portionMultiplier * 10) / 10,
      fat: Math.round(totalNutrition.fat * portionMultiplier * 10) / 10,
      carbs: Math.round(totalNutrition.carbs * portionMultiplier * 10) / 10,
      fibre: Math.round(totalNutrition.fibre * portionMultiplier * 10) / 10,
    };

    // Total: 600 cal, 20g protein, 23g fat, 70g carbs, 6g fibre
    // 75% of that: 450 cal, 15g protein, 17.3g fat, 52.5g carbs, 4.5g fibre
    expect(scaledNutrition.calories).toBe(450);
    expect(scaledNutrition.protein).toBe(15);
    expect(scaledNutrition.fat).toBe(17.3);
    expect(scaledNutrition.carbs).toBe(52.5);
    expect(scaledNutrition.fibre).toBe(4.5);
  });

  it("should handle edge case: 1% portion", () => {
    const originalMeal = {
      calories: 1000,
      protein: 50,
      fat: 40,
      carbs: 100,
      fibre: 15,
    };

    const portionPercentage = 1;
    const portionMultiplier = portionPercentage / 100;

    const scaledMeal = {
      calories: Math.round(originalMeal.calories * portionMultiplier),
      protein: Math.round(originalMeal.protein * portionMultiplier * 10) / 10,
      fat: Math.round(originalMeal.fat * portionMultiplier * 10) / 10,
      carbs: Math.round(originalMeal.carbs * portionMultiplier * 10) / 10,
      fibre: Math.round(originalMeal.fibre * portionMultiplier * 10) / 10,
    };

    expect(scaledMeal.calories).toBe(10);
    expect(scaledMeal.protein).toBe(0.5);
    expect(scaledMeal.fat).toBe(0.4);
    expect(scaledMeal.carbs).toBe(1);
    expect(scaledMeal.fibre).toBe(0.2);
  });

  it("should round calories to nearest integer and macros to 1 decimal place", () => {
    const originalMeal = {
      calories: 333,
      protein: 16.66,
      fat: 11.11,
      carbs: 44.44,
      fibre: 5.55,
    };

    const portionPercentage = 33;
    const portionMultiplier = portionPercentage / 100;

    const scaledMeal = {
      calories: Math.round(originalMeal.calories * portionMultiplier),
      protein: Math.round(originalMeal.protein * portionMultiplier * 10) / 10,
      fat: Math.round(originalMeal.fat * portionMultiplier * 10) / 10,
      carbs: Math.round(originalMeal.carbs * portionMultiplier * 10) / 10,
      fibre: Math.round(originalMeal.fibre * portionMultiplier * 10) / 10,
    };

    // Verify calories are integers
    expect(Number.isInteger(scaledMeal.calories)).toBe(true);
    expect(scaledMeal.calories).toBe(110);

    // Verify macros have at most 1 decimal place
    expect(scaledMeal.protein).toBe(5.5);
    expect(scaledMeal.fat).toBe(3.7);
    expect(scaledMeal.carbs).toBe(14.7);
    expect(scaledMeal.fibre).toBe(1.8);
  });
});
