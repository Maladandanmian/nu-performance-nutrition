import { analyzeNutritionReport } from './server/nutritionReportAnalysis.ts';

// Get report ID from command line or use default
const reportId = process.argv[2] ? parseInt(process.argv[2]) : 1;

console.log(`Analyzing nutrition report ID: ${reportId}`);

try {
  const result = await analyzeNutritionReport(reportId);
  console.log('Analysis completed successfully:');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Analysis failed:');
  console.error(error);
  process.exit(1);
}
