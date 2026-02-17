/**
 * Email templates for trainer notifications
 */

interface NutritionDeviationEmailData {
  trainerName: string;
  clientName: string;
  problematicNutrients: Array<{
    nutrient: string;
    direction: "over" | "under";
    averageDeviation: number;
  }>;
  consecutiveDays: number;
  dashboardUrl: string;
}

interface WellnessPoorScoreEmailData {
  trainerName: string;
  clientName: string;
  problematicMetrics: Array<{
    metric: string;
    averageScore: number;
  }>;
  consecutiveDays: number;
  dashboardUrl: string;
}

export function generateNutritionDeviationEmail(data: NutritionDeviationEmailData): { subject: string; html: string; text: string } {
  const { trainerName, clientName, problematicNutrients, consecutiveDays, dashboardUrl } = data;

  const nutrientList = problematicNutrients
    .map((n) => {
      const direction = n.direction === "over" ? "above" : "below";
      return `• ${n.nutrient}: ${Math.round(n.averageDeviation)}% ${direction} target`;
    })
    .join("\n");

  const nutrientListHtml = problematicNutrients
    .map((n) => {
      const direction = n.direction === "over" ? "above" : "below";
      const color = n.direction === "over" ? "#f59e0b" : "#ef4444";
      return `<li style="margin-bottom: 8px;"><strong style="color: ${color};">${n.nutrient}</strong>: ${Math.round(n.averageDeviation)}% ${direction} target</li>`;
    })
    .join("");

  const subject = `Alert: ${clientName} - Nutrition Deviation Pattern Detected`;

  const text = `Hi ${trainerName},

${clientName} has shown a consistent nutrition deviation pattern over the past ${consecutiveDays} days.

Problematic nutrients:
${nutrientList}

This pattern may require your attention to help ${clientName} get back on track with their nutrition goals.

View full details: ${dashboardUrl}

Best regards,
Nu Performance Nutrition`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #578DB3 0%, #4a7a9a 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Nutrition Alert</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${trainerName},</p>
      
      <p style="margin: 0 0 24px 0; font-size: 16px;">
        <strong style="color: #578DB3;">${clientName}</strong> has shown a consistent nutrition deviation pattern over the past <strong>${consecutiveDays} days</strong>.
      </p>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #92400e;">Problematic Nutrients:</h3>
        <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
          ${nutrientListHtml}
        </ul>
      </div>

      <p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280;">
        This pattern may require your attention to help ${clientName} get back on track with their nutrition goals.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #578DB3; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">View Full Details</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        Nu Performance Nutrition
      </p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
        You received this email because you have notifications enabled for client alerts.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

export function generateWellnessPoorScoreEmail(data: WellnessPoorScoreEmailData): { subject: string; html: string; text: string } {
  const { trainerName, clientName, problematicMetrics, consecutiveDays, dashboardUrl } = data;

  const metricList = problematicMetrics
    .map((m) => `• ${m.metric}: Average score ${m.averageScore.toFixed(1)}/5`)
    .join("\n");

  const metricListHtml = problematicMetrics
    .map((m) => {
      const color = m.averageScore <= 1.5 ? "#ef4444" : "#f59e0b";
      return `<li style="margin-bottom: 8px;"><strong style="color: ${color};">${m.metric}</strong>: Average score ${m.averageScore.toFixed(1)}/5</li>`;
    })
    .join("");

  const subject = `Alert: ${clientName} - Low Wellness Scores Detected`;

  const text = `Hi ${trainerName},

${clientName} has reported consistently poor wellness scores over the past ${consecutiveDays} days.

Problematic metrics:
${metricList}

These low scores may indicate that ${clientName} needs additional support or recovery time.

View full details: ${dashboardUrl}

Best regards,
Nu Performance Nutrition`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Wellness Alert</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${trainerName},</p>
      
      <p style="margin: 0 0 24px 0; font-size: 16px;">
        <strong style="color: #ef4444;">${clientName}</strong> has reported consistently poor wellness scores over the past <strong>${consecutiveDays} days</strong>.
      </p>

      <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #991b1b;">Problematic Metrics:</h3>
        <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
          ${metricListHtml}
        </ul>
      </div>

      <p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280;">
        These low scores may indicate that ${clientName} needs additional support or recovery time.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">View Full Details</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        Nu Performance Nutrition
      </p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
        You received this email because you have notifications enabled for client alerts.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}
