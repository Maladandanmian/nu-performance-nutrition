import { invokeLLM } from './_core/llm';
import * as db from './db';

export interface NutritionReportSummary {
  goals?: Array<{ category: string; target: string }>;
  currentStatus?: Array<{ metric: string; value: string }>;
  recommendations?: Array<{ category: string; details: string }>;
  monitoringPlan?: string[];
}

/**
 * Analyze nutrition report PDF and extract key information
 * @param reportId - Database ID of the nutrition report
 * @returns Structured summary of goals, targets, and recommendations
 */
export async function analyzeNutritionReport(
  reportId: number
): Promise<NutritionReportSummary> {
  console.log('[analyzeNutritionReport] Starting analysis for report ID:', reportId);
  
  // Get the report from database
  const report = await db.getNutritionReportById(reportId);
  console.log('[analyzeNutritionReport] Retrieved report:', report ? 'found' : 'not found');
  
  if (!report) {
    throw new Error('Nutrition report not found');
  }
  
  const pdfUrl = report.pdfUrl;
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a nutrition report analysis assistant. Extract and summarize key information from nutrition assessment reports with STRICT adherence to the standardised structure below.

**CRITICAL FORMATTING RULES:**
1. Goals Section - MUST include exactly these 5 categories (extract relevant data for each, or mark as "Not specified" if absent):
   - Weight Management
   - Body Composition
   - Macronutrient Balance
   - Sleep Quality
   - Hydration

2. Current Status Section - MUST include exactly these 10 categories (extract relevant data for each, or mark as "Not specified" if absent):
   - Current Weight (include BMI if available)
   - Body Composition (visceral fat, muscle mass, bone density if applicable)
   - Protein Intake
   - Carbohydrate Intake
   - Fat Intake
   - Hydration Patterns
   - Sleep Patterns
   - Diet Composition
   - Meal Timing & Eating Patterns
   - Notable Dietary Habits

3. Recommendations Section - MUST group all recommendations under exactly these 4 categories:
   - Macronutrient Adjustments (protein, carbs, fats, timing)
   - Meal & Snack Strategy (meal planning, snack replacements, portion control)
   - Lifestyle Modifications (sleep, hydration, stress management)
   - Supplementation (if applicable, otherwise omit)

**FORMATTING STANDARDS:**
- Goals: Use format "**Category:** Specific measurable target with units and timeframe"
- Current Status: Use format "**Metric:** Factual statement with measurements, ranges, or observations"
- Recommendations: Group by category, then provide numbered details with specific actions and examples

**PRIORITY:**
- Focus on nutrition-related metrics and interventions
- Include specific numbers, units, and targets wherever possible
- For follow-up reports, note progress against previous goals where evident
- Maintain professional, objective tone throughout`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please analyze this nutrition assessment report and extract the goals, current status, and key recommendations following the EXACT standardised structure specified in the system prompt. Ensure all required categories are present.",
          },
          {
            type: "file_url",
            file_url: {
              url: pdfUrl,
              mime_type: "application/pdf" as const,
            },
          },
        ] as any,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "nutrition_report_summary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            goals: {
              type: "array",
              description: "MUST include exactly 5 categories: Weight Management, Body Composition, Macronutrient Balance, Sleep Quality, Hydration",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    description: "MUST be one of: Weight Management, Body Composition, Macronutrient Balance, Sleep Quality, Hydration",
                  },
                  target: {
                    type: "string",
                    description: "Specific measurable target with units (e.g., 'Target weight <70 kg', 'Protein 140-150g/day', '7-8 hours sleep', '3L water daily')",
                  },
                },
                required: ["category", "target"],
                additionalProperties: false,
              },
            },
            currentStatus: {
              type: "array",
              description: "MUST include exactly 10 categories: Current Weight, Body Composition, Protein Intake, Carbohydrate Intake, Fat Intake, Hydration Patterns, Sleep Patterns, Diet Composition, Meal Timing & Eating Patterns, Notable Dietary Habits",
              items: {
                type: "object",
                properties: {
                  metric: {
                    type: "string",
                    description: "MUST be one of: Current Weight, Body Composition, Protein Intake, Carbohydrate Intake, Fat Intake, Hydration Patterns, Sleep Patterns, Diet Composition, Meal Timing & Eating Patterns, Notable Dietary Habits",
                  },
                  value: {
                    type: "string",
                    description: "Current value with measurements, ranges, or detailed observations (e.g., '75-77 kg, BMI ~27', '80-90g/day', 'Predominantly plant-based for 25 years')",
                  },
                },
                required: ["metric", "value"],
                additionalProperties: false,
              },
            },
            recommendations: {
              type: "array",
              description: "MUST group under exactly 3-4 categories: Macronutrient Adjustments, Meal & Snack Strategy, Lifestyle Modifications, and optionally Supplementation",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    description: "MUST be one of: Macronutrient Adjustments, Meal & Snack Strategy, Lifestyle Modifications, Supplementation",
                  },
                  details: {
                    type: "string",
                    description: "Specific, actionable recommendation with examples and alternatives (e.g., 'Increase protein to 140-150g/day. Evening meals should target 35-40g protein. Use 0% fat Greek yogurt and whey protein post-training.')",
                  },
                },
                required: ["category", "details"],
                additionalProperties: false,
              },
            },
            monitoringPlan: {
              type: "array",
              description: "Follow-up and monitoring actions",
              items: {
                type: "string",
                description: "Monitoring action (e.g., 'Weekly weigh-ins', 'Baseline DEXA scan', 'Monthly progress photos')",
              },
            },
          },
          required: ["goals", "currentStatus", "recommendations", "monitoringPlan"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  console.log('[analyzeNutritionReport] LLM response received, parsing...');
  
  const summary = JSON.parse(contentStr) as NutritionReportSummary;
  console.log('[analyzeNutritionReport] Parsed summary:', JSON.stringify(summary, null, 2));
  
  // Update the database with extracted summary
  console.log('[analyzeNutritionReport] Updating database...');
  await db.updateNutritionReportSummary(reportId, {
    goals: formatGoalsAndTargets(summary.goals),
    currentStatus: formatCurrentStatus(summary.currentStatus),
    recommendations: formatRecommendations(summary.recommendations),
  });
  
  console.log('[analyzeNutritionReport] Analysis complete!');
  return summary;
}

// Helper functions to format the extracted data for display
function formatGoalsAndTargets(goals: NutritionReportSummary['goals']): string {
  if (!goals || goals.length === 0) return '';
  
  // Enforce standard order
  const standardOrder = [
    'Weight Management',
    'Body Composition',
    'Macronutrient Balance',
    'Sleep Quality',
    'Hydration'
  ];
  
  const sortedGoals = goals.sort((a, b) => {
    const indexA = standardOrder.indexOf(a.category);
    const indexB = standardOrder.indexOf(b.category);
    return indexA - indexB;
  });
  
  return sortedGoals
    .map(goal => `**${goal.category}:** ${goal.target}`)
    .join('\n\n');
}

function formatCurrentStatus(status: NutritionReportSummary['currentStatus']): string {
  if (!status || status.length === 0) return '';
  
  // Enforce standard order
  const standardOrder = [
    'Current Weight',
    'Body Composition',
    'Protein Intake',
    'Carbohydrate Intake',
    'Fat Intake',
    'Hydration Patterns',
    'Sleep Patterns',
    'Diet Composition',
    'Meal Timing & Eating Patterns',
    'Notable Dietary Habits'
  ];
  
  const sortedStatus = status.sort((a, b) => {
    const indexA = standardOrder.indexOf(a.metric);
    const indexB = standardOrder.indexOf(b.metric);
    return indexA - indexB;
  });
  
  return sortedStatus
    .map(item => `**${item.metric}:** ${item.value}`)
    .join('\n\n');
}

function formatRecommendations(recommendations?: Array<{ category: string; details: string }>): string {
  if (!recommendations || recommendations.length === 0) return '';
  
  // Enforce standard order
  const standardOrder = [
    'Macronutrient Adjustments',
    'Meal & Snack Strategy',
    'Lifestyle Modifications',
    'Supplementation'
  ];
  
  const sortedRecs = recommendations.sort((a, b) => {
    const indexA = standardOrder.indexOf(a.category);
    const indexB = standardOrder.indexOf(b.category);
    return indexA - indexB;
  });
  
  return sortedRecs
    .map(rec => `**${rec.category}**; ${rec.details}`)
    .join('\n\n');
}
