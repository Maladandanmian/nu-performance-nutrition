import { describe, it, expect, afterAll } from 'vitest';
import { TEST_CLIENT_ID } from './testSetup';
import { createNutritionReport, getLatestNutritionReport, updateNutritionReportSummary, deleteNutritionReport } from './db';

describe('Nutrition Reports', () => {
  let testReportId: number;

  it('should create a nutrition report', async () => {
    const result = await createNutritionReport({
      clientId: TEST_CLIENT_ID,
      pdfUrl: 'https://example.com/test-report.pdf',
      pdfFileKey: 'test-reports/test-report.pdf',
      filename: 'test-report.pdf',
      reportDate: new Date('2026-01-30'),
      uploadedBy: 1, // Admin user ID
    });

    expect(result).toBeDefined();
    // Get the created report to get its ID
    const created = await getLatestNutritionReport(TEST_CLIENT_ID);
    expect(created).toBeDefined();
    testReportId = created!.id;
    expect(testReportId).toBeGreaterThan(0);
  });

  it('should get nutrition report by client ID', async () => {
    const report = await getLatestNutritionReport(TEST_CLIENT_ID);

    expect(report).toBeDefined();
    expect(report?.clientId).toBe(TEST_CLIENT_ID);
    expect(report?.filename).toBe('test-report.pdf');
    expect(report?.pdfUrl).toBe('https://example.com/test-report.pdf');
  });

  it('should update nutrition report summary', async () => {
    await updateNutritionReportSummary({
      reportId: testReportId,
      goals: '**Weight Management:** Target <70kg\n**Protein:** 140-150g/day',
      currentStatus: '**Current Weight:** 75-77kg\n**Current Protein:** 80-90g/day',
      recommendations: '**Increase protein intake**\n**Reduce evening carbs**',
    });

    const updated = await getLatestNutritionReport(TEST_CLIENT_ID);
    expect(updated?.goalsText).toContain('Weight Management');
    expect(updated?.currentStatusText).toContain('Current Weight');
    expect(updated?.recommendationsText).toContain('protein intake');
  });

  it('should reflect updated summary in subsequent queries', async () => {
    const report = await getLatestNutritionReport(TEST_CLIENT_ID);

    expect(report?.goalsText).toBeTruthy();
    expect(report?.currentStatusText).toBeTruthy();
    expect(report?.recommendationsText).toBeTruthy();
  });

  it('should delete nutrition report', async () => {
    await deleteNutritionReport(testReportId);

    const latest = await getLatestNutritionReport(TEST_CLIENT_ID);
    // Should not return the deleted report (may return other reports for this client)
    expect(latest?.id).not.toBe(testReportId);
  });

  // Cleanup: Delete any test reports created during this test run
  afterAll(async () => {
    // Already deleted in the last test, but ensure cleanup
    try {
      if (testReportId) {
        await deleteNutritionReport(testReportId);
      }
    } catch (error) {
      // Ignore errors if already deleted
    }
  });
});
