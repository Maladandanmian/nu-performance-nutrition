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
        content: `You are a nutrition report analysis assistant. Extract and summarize key information from nutrition assessment reports.

Focus on extracting:
1. Goals & Objectives - specific, measurable targets (e.g., weight goals, macronutrient targets, sleep hours, hydration)
2. Current Status - baseline measurements and current state
3. Key Recommendations - actionable intervention strategies
4. Monitoring Plan - follow-up actions and tracking methods

Return a structured JSON summary that is concise, actionable, and easy for trainers to review and edit.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please analyze this nutrition assessment report and extract the goals, current status, key recommendations, and monitoring plan.",
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
              description: "List of specific goals and targets from the report",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    description: "Goal category (e.g., Weight Management, Macronutrient Balance, Sleep Quality)",
                  },
                  target: {
                    type: "string",
                    description: "Specific measurable target (e.g., 'Target weight <70 kg', 'Protein 140-150g/day')",
                  },
                },
                required: ["category", "target"],
                additionalProperties: false,
              },
            },
            currentStatus: {
              type: "array",
              description: "Current baseline measurements and status",
              items: {
                type: "object",
                properties: {
                  metric: {
                    type: "string",
                    description: "Metric name (e.g., Current Weight, Current Protein Intake)",
                  },
                  value: {
                    type: "string",
                    description: "Current value (e.g., '75-77 kg', '80-90g/day')",
                  },
                },
                required: ["metric", "value"],
                additionalProperties: false,
              },
            },
            recommendations: {
              type: "array",
              description: "Key actionable recommendations from the intervention plan",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    description: "Recommendation category (e.g., Macronutrient Adjustments, Meal Strategy)",
                  },
                  details: {
                    type: "string",
                    description: "Specific recommendation details",
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
                description: "Monitoring action (e.g., 'Weekly weigh-ins', 'Baseline DEXA scan')",
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
  
  return goals
    .map(goal => `**${goal.category}:** ${goal.target}`)
    .join('\n\n');
}

function formatCurrentStatus(status: NutritionReportSummary['currentStatus']): string {
  if (!status || status.length === 0) return '';
  
  return status
    .map(item => `**${item.metric}:** ${item.value}`)
    .join('\n\n');
}

function formatRecommendations(recommendations?: Array<{ category: string; details: string }>): string {
  if (!recommendations || recommendations.length === 0) return '';
  
  return recommendations
    .map(rec => `**${rec.category}**\n${rec.details}`)
    .join('\n\n');
}
