import {
  getDailyNutritionTotals,
  getAthleteMonitoringScores,
  getNutritionGoalByClientId,
  getNotificationSettings,
  createTrainerNotification,
  hasRecentNotification,
  getClientById,
  getUserById,
} from "./db";
import { sendEmail } from "./emailService";
import { generateNutritionDeviationEmail, generateWellnessPoorScoreEmail } from "./emailTemplates";
import { ENV } from "./_core/env";

/**
 * Nutrition deviation pattern detection
 * Checks if a client has been consistently over/under nutrition targets for N consecutive days
 */
export async function detectNutritionDeviationPattern(
  clientId: number,
  trainerId: number
): Promise<{ hasPattern: boolean; details?: any }> {
  // Get notification settings for threshold and days
  const settings = await getNotificationSettings(trainerId);
  const threshold = settings.nutritionDeviationThreshold; // e.g., 20%
  const consecutiveDays = settings.nutritionDeviationDays; // e.g., 5

  if (!settings.nutritionDeviationEnabled) {
    return { hasPattern: false };
  }

  // Get nutrition goals
  const goals = await getNutritionGoalByClientId(clientId);
  if (!goals) {
    return { hasPattern: false };
  }

  // Get daily nutrition totals for the last N days
  const dailyTotals = await getDailyNutritionTotals(clientId, consecutiveDays);

  if (dailyTotals.length < consecutiveDays) {
    return { hasPattern: false }; // Not enough data
  }

  // Get the last N consecutive days
  const recentDays = dailyTotals.slice(-consecutiveDays);

  // Track deviations for each nutrient
  const deviations = {
    calories: [] as number[],
    protein: [] as number[],
    fat: [] as number[],
    carbs: [] as number[],
    fibre: [] as number[],
  };

  // Calculate deviation percentage for each day and nutrient
  for (const day of recentDays) {
    deviations.calories.push(calculateDeviationPercent(day.calories, goals.caloriesTarget));
    deviations.protein.push(calculateDeviationPercent(day.protein, goals.proteinTarget));
    deviations.fat.push(calculateDeviationPercent(day.fat, goals.fatTarget));
    deviations.carbs.push(calculateDeviationPercent(day.carbs, goals.carbsTarget));
    deviations.fibre.push(calculateDeviationPercent(day.fibre, goals.fibreTarget));
  }

  // Check if any nutrient has consistent deviation above threshold
  const problematicNutrients: Array<{
    nutrient: string;
    avgDeviation: number;
    direction: "over" | "under";
  }> = [];

  for (const [nutrient, deviationArray] of Object.entries(deviations)) {
    // Check if all days exceed the threshold in the same direction
    const allOver = deviationArray.every((d) => d > threshold);
    const allUnder = deviationArray.every((d) => d < -threshold);

    if (allOver || allUnder) {
      const avgDeviation = deviationArray.reduce((a, b) => a + b, 0) / deviationArray.length;
      problematicNutrients.push({
        nutrient,
        avgDeviation: Math.abs(avgDeviation),
        direction: allOver ? "over" : "under",
      });
    }
  }

  if (problematicNutrients.length > 0) {
    return {
      hasPattern: true,
      details: {
        consecutiveDays,
        threshold,
        problematicNutrients,
        recentDays: recentDays.map((d) => ({
          date: d.date,
          calories: d.calories,
          protein: d.protein,
          fat: d.fat,
          carbs: d.carbs,
          fibre: d.fibre,
        })),
      },
    };
  }

  return { hasPattern: false };
}

/**
 * Wellness questionnaire poor score pattern detection
 * Checks if a client has been scoring poorly on any wellness metric for N consecutive days
 */
export async function detectWellnessPoorScorePattern(
  clientId: number,
  trainerId: number
): Promise<{ hasPattern: boolean; details?: any }> {
  // Get notification settings
  const settings = await getNotificationSettings(trainerId);
  const poorScoreThreshold = settings.wellnessPoorScoreThreshold; // e.g., 2 or below
  const consecutiveDays = settings.wellnessPoorScoreDays; // e.g., 5

  if (!settings.wellnessAlertsEnabled) {
    return { hasPattern: false };
  }

  // Get athlete monitoring scores for the last N days
  const scores = await getAthleteMonitoringScores(clientId, consecutiveDays);

  if (scores.length < consecutiveDays) {
    return { hasPattern: false }; // Not enough data
  }

  // Get the last N consecutive days
  const recentScores = scores.slice(-consecutiveDays);

  // Track poor scores for each metric
  const metrics = ["fatigue", "sleepQuality", "muscleSoreness", "stressLevels", "mood"] as const;
  const problematicMetrics: Array<{
    metric: string;
    avgScore: number;
    scores: number[];
  }> = [];

  for (const metric of metrics) {
    const metricScores = recentScores.map((s) => s[metric]);

    // Check if all days have poor scores for this metric
    const allPoor = metricScores.every((score) => score <= poorScoreThreshold);

    if (allPoor) {
      const avgScore = metricScores.reduce((a, b) => a + b, 0) / metricScores.length;
      problematicMetrics.push({
        metric: formatMetricName(metric),
        avgScore,
        scores: metricScores,
      });
    }
  }

  if (problematicMetrics.length > 0) {
    return {
      hasPattern: true,
      details: {
        consecutiveDays,
        poorScoreThreshold,
        problematicMetrics,
        recentScores: recentScores.map((s) => ({
          date: s.submittedAt.toISOString().split("T")[0],
          fatigue: s.fatigue,
          sleepQuality: s.sleepQuality,
          muscleSoreness: s.muscleSoreness,
          stressLevels: s.stressLevels,
          mood: s.mood,
        })),
      },
    };
  }

  return { hasPattern: false };
}

/**
 * Generate and send notification for nutrition deviation pattern
 */
export async function sendNutritionDeviationNotification(
  clientId: number,
  trainerId: number,
  details: any
) {
  // Check if we already sent a similar notification recently
  const hasRecent = await hasRecentNotification(trainerId, clientId, "nutrition_deviation", 24);
  if (hasRecent) {
    return; // Don't send duplicate
  }

  // Get client info
  const client = await getClientById(clientId);
  if (!client) return;

  // Build notification message
  const nutrientList = details.problematicNutrients
    .map((n: any) => `${n.nutrient} (${n.avgDeviation.toFixed(0)}% ${n.direction})`)
    .join(", ");

  const title = `Nutrition Alert: ${client.name}`;
  const message = `${client.name} has been consistently ${details.consecutiveDays} days ${details.threshold}%+ ${
    details.problematicNutrients[0].direction
  } target for: ${nutrientList}. Review their nutrition logs and consider adjusting their meal plan.`;

  // Determine severity based on average deviation
  const maxDeviation = Math.max(...details.problematicNutrients.map((n: any) => n.avgDeviation));
  const severity = maxDeviation > 40 ? "critical" : maxDeviation > 30 ? "warning" : "info";

  await createTrainerNotification({
    trainerId,
    clientId,
    type: "nutrition_deviation",
    severity,
    title,
    message,
    metadata: details,
    isRead: false,
    isDismissed: false,
  });

  // Send email notification if enabled
  const settings = await getNotificationSettings(trainerId);
  if (settings.emailNotificationsEnabled) {
    const trainer = await getUserById(trainerId);
    if (trainer && trainer.email) {
      const dashboardUrl = `${ENV.appUrl}/trainer/client/${clientId}`;
      const emailData = generateNutritionDeviationEmail({
        trainerName: trainer.name || "Trainer",
        clientName: client.name,
        problematicNutrients: details.problematicNutrients.map((n: any) => ({
          nutrient: n.nutrient,
          direction: n.direction,
          averageDeviation: n.avgDeviation,
        })),
        consecutiveDays: details.consecutiveDays,
        dashboardUrl,
      });

      await sendEmail({
        to: trainer.email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });
    }
  }
}

/**
 * Generate and send notification for wellness poor score pattern
 */
export async function sendWellnessPoorScoreNotification(
  clientId: number,
  trainerId: number,
  details: any
) {
  // Check if we already sent a similar notification recently
  const hasRecent = await hasRecentNotification(trainerId, clientId, "wellness_poor_scores", 24);
  if (hasRecent) {
    return; // Don't send duplicate
  }

  // Get client info
  const client = await getClientById(clientId);
  if (!client) return;

  // Build notification message
  const metricList = details.problematicMetrics
    .map((m: any) => `${m.metric} (avg: ${m.avgScore.toFixed(1)}/5)`)
    .join(", ");

  const title = `Wellness Alert: ${client.name}`;
  const message = `${client.name} has been reporting poor scores for ${details.consecutiveDays} consecutive days on: ${metricList}. Consider checking in with them about their recovery and well-being.`;

  // Determine severity based on how many metrics are affected
  const severity =
    details.problematicMetrics.length >= 3
      ? "critical"
      : details.problematicMetrics.length >= 2
      ? "warning"
      : "info";

  await createTrainerNotification({
    trainerId,
    clientId,
    type: "wellness_poor_scores",
    severity,
    title,
    message,
    metadata: details,
    isRead: false,
    isDismissed: false,
  });

  // Send email notification if enabled
  const settings = await getNotificationSettings(trainerId);
  if (settings.emailNotificationsEnabled) {
    const trainer = await getUserById(trainerId);
    if (trainer && trainer.email) {
      const dashboardUrl = `${ENV.appUrl}/trainer/client/${clientId}`;
      const emailData = generateWellnessPoorScoreEmail({
        trainerName: trainer.name || "Trainer",
        clientName: client.name,
        problematicMetrics: details.problematicMetrics.map((m: any) => ({
          metric: m.metric,
          averageScore: m.avgScore,
        })),
        consecutiveDays: details.consecutiveDays,
        dashboardUrl,
      });

      await sendEmail({
        to: trainer.email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });
    }
  }
}

/**
 * Check all patterns for a specific client and send notifications if needed
 */
export async function checkClientPatterns(clientId: number, trainerId: number) {
  // Check nutrition deviation pattern
  const nutritionPattern = await detectNutritionDeviationPattern(clientId, trainerId);
  if (nutritionPattern.hasPattern && nutritionPattern.details) {
    await sendNutritionDeviationNotification(clientId, trainerId, nutritionPattern.details);
  }

  // Check wellness poor score pattern
  const wellnessPattern = await detectWellnessPoorScorePattern(clientId, trainerId);
  if (wellnessPattern.hasPattern && wellnessPattern.details) {
    await sendWellnessPoorScoreNotification(clientId, trainerId, wellnessPattern.details);
  }
}

/**
 * Check patterns for all clients of a trainer
 */
export async function checkAllClientsForTrainer(trainerId: number) {
  const { getClientsByTrainerId } = await import("./db");
  const clients = await getClientsByTrainerId(trainerId);

  for (const client of clients) {
    await checkClientPatterns(client.id, trainerId);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate deviation percentage from target
 * Positive = over target, Negative = under target
 */
function calculateDeviationPercent(actual: number, target: number): number {
  if (target === 0) return 0;
  return ((actual - target) / target) * 100;
}

/**
 * Format metric name for display
 */
function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    fatigue: "Fatigue",
    sleepQuality: "Sleep Quality",
    muscleSoreness: "Muscle Soreness",
    stressLevels: "Stress Levels",
    mood: "Mood",
  };
  return names[metric] || metric;
}
