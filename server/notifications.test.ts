import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import {
  detectNutritionDeviationPattern,
  detectWellnessPoorScorePattern,
  sendNutritionDeviationNotification,
  sendWellnessPoorScoreNotification,
  checkClientPatterns,
} from "./notificationService";

describe("Trainer Notification System", () => {
  let trainerId: number;
  let clientId: number;

  beforeAll(async () => {
    // Create a test trainer
    const trainerOpenId = `test-trainer-${Date.now()}`;
    await db.upsertUser({
      openId: trainerOpenId,
      name: "Test Trainer",
      email: "trainer@test.com",
      role: "admin",
    });

    const trainer = await db.getUserByOpenId(trainerOpenId);
    if (!trainer) throw new Error("Failed to create test trainer");
    trainerId = trainer.id;

    // Create a test client
    const [clientResult] = await db.createClient({
      trainerId,
      name: "Test Client",
      email: "client@test.com",
      authMethod: "email",
    });
    clientId = clientResult.insertId;

    // Create nutrition goals for the client
    await db.createNutritionGoal({
      clientId,
      caloriesTarget: 2000,
      proteinTarget: 150,
      fatTarget: 65,
      carbsTarget: 250,
      fibreTarget: 25,
      hydrationTarget: 2000,
    });

    // Create notification settings for the trainer
    await db.getNotificationSettings(trainerId);
  });

  afterAll(async () => {
    // Clean up: delete test client and trainer
    if (clientId) {
      await db.deleteClientAndData(clientId);
    }
  });

  describe("Nutrition Deviation Pattern Detection", () => {
    it("should detect nutrition deviation pattern when client consistently exceeds targets", async () => {
      // Create 5 consecutive days of meals exceeding protein target by 30%
      const today = new Date();
      for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createMeal({
          clientId,
          calories: 2000,
          protein: 195, // 30% over 150g target
          fat: 65,
          carbs: 250,
          fibre: 25,
          loggedAt: date,
          imageUrl: "test.jpg",
          imageKey: "test.jpg",
          aiDescription: "Test meal",
        });
      }

      const result = await detectNutritionDeviationPattern(clientId, trainerId);

      expect(result.hasPattern).toBe(true);
      expect(result.details).toBeDefined();
      expect(result.details.problematicNutrients).toHaveLength(1);
      expect(result.details.problematicNutrients[0].nutrient).toBe("protein");
      expect(result.details.problematicNutrients[0].direction).toBe("over");
    });

    it("should not detect pattern when deviation is below threshold", async () => {
      // Clear previous meals
      const meals = await db.getMealsByClientId(clientId);
      for (const meal of meals) {
        await db.deleteMeal(meal.id);
      }

      // Create 5 days of meals with only 10% deviation (below 20% threshold)
      const today = new Date();
      for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createMeal({
          clientId,
          calories: 2000,
          protein: 165, // 10% over 150g target
          fat: 65,
          carbs: 250,
          fibre: 25,
          loggedAt: date,
          imageUrl: "test.jpg",
          imageKey: "test.jpg",
          aiDescription: "Test meal",
        });
      }

      const result = await detectNutritionDeviationPattern(clientId, trainerId);

      expect(result.hasPattern).toBe(false);
    });

    it("should not detect pattern when there are not enough consecutive days", async () => {
      // Clear previous meals
      const meals = await db.getMealsByClientId(clientId);
      for (const meal of meals) {
        await db.deleteMeal(meal.id);
      }

      // Create only 3 days of meals (below 5-day threshold)
      const today = new Date();
      for (let i = 2; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createMeal({
          clientId,
          calories: 2000,
          protein: 195, // 30% over target
          fat: 65,
          carbs: 250,
          fibre: 25,
          loggedAt: date,
          imageUrl: "test.jpg",
          imageKey: "test.jpg",
          aiDescription: "Test meal",
        });
      }

      const result = await detectNutritionDeviationPattern(clientId, trainerId);

      expect(result.hasPattern).toBe(false);
    });
  });

  describe("Wellness Poor Score Pattern Detection", () => {
    it("should detect wellness poor score pattern when client consistently reports poor scores", async () => {
      // Create 5 consecutive days of poor wellness scores
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 20); // Start 20 days ago
      for (let i = 4; i >= 0; i--) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        date.setHours(10, 0, 0, 0);

        await db.submitAthleteMonitoring({
          clientId,
          fatigue: 1, // Poor score (threshold is 2 or below)
          sleepQuality: 2,
          muscleSoreness: 1,
          stressLevels: 1,
          mood: 2,
          submittedAt: date,
        });
      }

      const result = await detectWellnessPoorScorePattern(clientId, trainerId);

      expect(result.hasPattern).toBe(true);
      expect(result.details).toBeDefined();
      expect(result.details.problematicMetrics.length).toBeGreaterThan(0);
      
      // Check that fatigue, muscleSoreness, and stressLevels are flagged
      const metricNames = result.details.problematicMetrics.map((m: any) => m.metric);
      expect(metricNames).toContain("Fatigue");
      expect(metricNames).toContain("Muscle Soreness");
      expect(metricNames).toContain("Stress Levels");
    });

    it("should not detect pattern when scores are above threshold", async () => {
      // Delete previous wellness submissions
      // (Note: There's no direct delete function, so we'll rely on the fact that
      // the pattern detection looks at the most recent N days)

      // Create 5 days of good wellness scores
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 30); // Start 30 days ago
      for (let i = 4; i >= 0; i--) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        date.setHours(10, 0, 0, 0);

        await db.submitAthleteMonitoring({
          clientId,
          fatigue: 4, // Good score
          sleepQuality: 4,
          muscleSoreness: 4,
          stressLevels: 4,
          mood: 4,
          submittedAt: date,
        });
      }

      const result = await detectWellnessPoorScorePattern(clientId, trainerId);

      expect(result.hasPattern).toBe(false);
    });
  });

  describe("Notification Generation", () => {
    it("should create a notification for nutrition deviation", async () => {
      // Clear previous meals
      const meals = await db.getMealsByClientId(clientId);
      for (const meal of meals) {
        await db.deleteMeal(meal.id);
      }

      // Create pattern
      const today = new Date();
      for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createMeal({
          clientId,
          calories: 2000,
          protein: 195, // 30% over target
          fat: 65,
          carbs: 250,
          fibre: 25,
          loggedAt: date,
          imageUrl: "test.jpg",
          imageKey: "test.jpg",
          aiDescription: "Test meal",
        });
      }

      const pattern = await detectNutritionDeviationPattern(clientId, trainerId);
      expect(pattern.hasPattern).toBe(true);

      await sendNutritionDeviationNotification(clientId, trainerId, pattern.details);

      const notifications = await db.getUnreadNotifications(trainerId);
      const nutritionNotification = notifications.find(
        (n) => n.type === "nutrition_deviation" && n.clientId === clientId
      );

      expect(nutritionNotification).toBeDefined();
      expect(nutritionNotification?.title).toContain("Test Client");
      expect(nutritionNotification?.message).toContain("protein");
    });

    it("should not create duplicate notifications within 24 hours", async () => {
      const pattern = await detectNutritionDeviationPattern(clientId, trainerId);
      expect(pattern.hasPattern).toBe(true);

      // Try to send notification again
      await sendNutritionDeviationNotification(clientId, trainerId, pattern.details);

      const notifications = await db.getUnreadNotifications(trainerId);
      const nutritionNotifications = notifications.filter(
        (n) => n.type === "nutrition_deviation" && n.clientId === clientId
      );

      // Should still only have 1 notification (not duplicated)
      expect(nutritionNotifications).toHaveLength(1);
    });

    it("should create a notification for wellness poor scores", async () => {
      // Create pattern with unique timestamps to avoid "already submitted today" error
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 40); // Start 40 days ago
      
      for (let i = 4; i >= 0; i--) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        date.setHours(10, 0, 0, 0); // Set to 10 AM

        await db.submitAthleteMonitoring({
          clientId,
          fatigue: 1,
          sleepQuality: 1,
          muscleSoreness: 1,
          stressLevels: 1,
          mood: 1,
          submittedAt: date,
        });
      }

      const pattern = await detectWellnessPoorScorePattern(clientId, trainerId);
      expect(pattern.hasPattern).toBe(true);

      await sendWellnessPoorScoreNotification(clientId, trainerId, pattern.details);

      const notifications = await db.getUnreadNotifications(trainerId);
      const wellnessNotification = notifications.find(
        (n) => n.type === "wellness_poor_scores" && n.clientId === clientId
      );

      expect(wellnessNotification).toBeDefined();
      expect(wellnessNotification?.title).toContain("Test Client");
      expect(wellnessNotification?.severity).toBe("critical"); // All 5 metrics are poor
    });
  });

  describe("Check Client Patterns", () => {
    it("should check all patterns for a client and generate notifications", async () => {
      // Clear previous notifications
      const existingNotifications = await db.getUnreadNotifications(trainerId);
      for (const notification of existingNotifications) {
        await db.dismissNotification(notification.id);
      }

      // Clear previous meals
      const meals = await db.getMealsByClientId(clientId);
      for (const meal of meals) {
        await db.deleteMeal(meal.id);
      }

      // Create nutrition deviation pattern
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 50); // Start 50 days ago
      for (let i = 4; i >= 0; i--) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        date.setHours(10, 0, 0, 0);

        await db.createMeal({
          clientId,
          calories: 2600, // 30% over 2000 target
          protein: 195,
          fat: 85, // 30% over 65 target
          carbs: 325, // 30% over 250 target
          fibre: 33, // 30% over 25 target
          loggedAt: date,
          imageUrl: "test.jpg",
          imageKey: "test.jpg",
          aiDescription: "Test meal",
        });

        // Also create wellness poor scores
        await db.submitAthleteMonitoring({
          clientId,
          fatigue: 1,
          sleepQuality: 1,
          muscleSoreness: 1,
          stressLevels: 1,
          mood: 1,
          submittedAt: date,
        });
      }

      await checkClientPatterns(clientId, trainerId);

      const notifications = await db.getUnreadNotifications(trainerId);
      const clientNotifications = notifications.filter((n) => n.clientId === clientId);

      // Should have both nutrition and wellness notifications
      expect(clientNotifications.length).toBeGreaterThanOrEqual(2);
      
      const types = clientNotifications.map((n) => n.type);
      expect(types).toContain("nutrition_deviation");
      expect(types).toContain("wellness_poor_scores");
    });
  });
});
