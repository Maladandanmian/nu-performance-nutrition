/**
 * Demo script to send sample trainer alert emails
 * Run with: node --loader tsx server/sendDemoEmails.ts
 */

import { sendEmail } from "./emailService";
import { generateNutritionDeviationEmail, generateWellnessPoorScoreEmail } from "./emailTemplates";
import { ENV } from "./_core/env";

const TRAINER_EMAILS = [
  { name: "Luke", email: "lukusdavey@gmail.com" },
  { name: "Andy", email: "andy@andyknight.asia" },
];

async function sendDemoEmails() {
  console.log("Sending demo trainer alert emails...\n");

  for (const trainer of TRAINER_EMAILS) {
    console.log(`Sending to ${trainer.name} (${trainer.email})...`);

    // 1. Nutrition Deviation Alert
    const nutritionEmail = generateNutritionDeviationEmail({
      trainerName: trainer.name,
      clientName: "TEST CLIENT",
      problematicNutrients: [
        { nutrient: "Protein", direction: "under", averageDeviation: 35 },
        { nutrient: "Calories", direction: "under", averageDeviation: 28 },
      ],
      consecutiveDays: 5,
      dashboardUrl: `${ENV.appUrl}/trainer/client/2`,
    });

    try {
      await sendEmail({
        to: trainer.email,
        subject: nutritionEmail.subject,
        html: nutritionEmail.html,
        text: nutritionEmail.text,
      });
      console.log(`  ✓ Nutrition deviation alert sent`);
    } catch (error) {
      console.error(`  ✗ Failed to send nutrition alert:`, error);
    }

    // 2. Wellness Poor Score Alert
    const wellnessEmail = generateWellnessPoorScoreEmail({
      trainerName: trainer.name,
      clientName: "TEST CLIENT",
      problematicMetrics: [
        { metric: "Sleep Quality", averageScore: 1.8 },
        { metric: "Energy Levels", averageScore: 2.0 },
        { metric: "Stress Levels", averageScore: 1.6 },
      ],
      consecutiveDays: 5,
      dashboardUrl: `${ENV.appUrl}/trainer/client/2`,
    });

    try {
      await sendEmail({
        to: trainer.email,
        subject: wellnessEmail.subject,
        html: wellnessEmail.html,
        text: wellnessEmail.text,
      });
      console.log(`  ✓ Wellness poor score alert sent`);
    } catch (error) {
      console.error(`  ✗ Failed to send wellness alert:`, error);
    }

    console.log();
  }

  console.log("Demo emails sent successfully!");
}

sendDemoEmails().catch(console.error);
