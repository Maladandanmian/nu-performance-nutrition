import { describe, it, expect, afterAll } from 'vitest';
import { TEST_CLIENT_ID } from './testSetup';
import { createNutritionReport, getNutritionReportsByClientId, getLatestNutritionReport, updateNutritionReportSummary, deleteNutritionReport } from './db';

describe('Nutrition Reports', () => {
  const testReportIds: number[] = [];

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
    testReportIds.push(created!.id);
    expect(created!.id).toBeGreaterThan(0);
  });

  it('should get nutrition report by client ID', async () => {
    const report = await getLatestNutritionReport(TEST_CLIENT_ID);

    expect(report).toBeDefined();
    expect(report?.clientId).toBe(TEST_CLIENT_ID);
    expect(report?.filename).toBe('test-report.pdf');
    expect(report?.pdfUrl).toBe('https://example.com/test-report.pdf');
  });

  it('should create multiple nutrition reports', async () => {
    // Create a second report
    await createNutritionReport({
      clientId: TEST_CLIENT_ID,
      pdfUrl: 'https://example.com/test-report-2.pdf',
      pdfFileKey: 'test-reports/test-report-2.pdf',
      filename: 'test-report-2.pdf',
      reportDate: new Date('2026-02-05'),
      uploadedBy: 1,
    });

    // Create a third report
    await createNutritionReport({
      clientId: TEST_CLIENT_ID,
      pdfUrl: 'https://example.com/test-report-3.pdf',
      pdfFileKey: 'test-reports/test-report-3.pdf',
      filename: 'test-report-3.pdf',
      reportDate: new Date('2026-02-10'),
      uploadedBy: 1,
    });

    const allReports = await getNutritionReportsByClientId(TEST_CLIENT_ID);
    expect(allReports.length).toBeGreaterThanOrEqual(3);
    
    // Store all report IDs for cleanup
    allReports.forEach(report => {
      if (!testReportIds.includes(report.id)) {
        testReportIds.push(report.id);
      }
    });
  });

  it('should get all nutrition reports ordered by date (newest first)', async () => {
    const reports = await getNutritionReportsByClientId(TEST_CLIENT_ID);
    
    expect(reports.length).toBeGreaterThanOrEqual(3);
    // Verify ordering - newest first
    for (let i = 0; i < reports.length - 1; i++) {
      const currentDate = new Date(reports[i].reportDate).getTime();
      const nextDate = new Date(reports[i + 1].reportDate).getTime();
      expect(currentDate).toBeGreaterThanOrEqual(nextDate);
    }
  });

  it('should update nutrition report summary', async () => {
    const firstReportId = testReportIds[0];
    await updateNutritionReportSummary(firstReportId, {
      goals: '**Weight Management:** Target <70kg\n**Protein:** 140-150g/day',
      currentStatus: '**Current Weight:** 75-77kg\n**Current Protein:** 80-90g/day',
      recommendations: '**Increase protein intake**\n**Reduce evening carbs**',
    });

    const allReports = await getNutritionReportsByClientId(TEST_CLIENT_ID);
    const updated = allReports.find(r => r.id === firstReportId);
    expect(updated?.goalsText).toContain('Weight Management');
    expect(updated?.currentStatusText).toContain('Current Weight');
    expect(updated?.recommendationsText).toContain('protein intake');
  });

  it('should reflect updated summary in subsequent queries', async () => {
    const firstReportId = testReportIds[0];
    const allReports = await getNutritionReportsByClientId(TEST_CLIENT_ID);
    const report = allReports.find(r => r.id === firstReportId);

    expect(report?.goalsText).toBeTruthy();
    expect(report?.currentStatusText).toBeTruthy();
    expect(report?.recommendationsText).toBeTruthy();
  });

  it('should delete nutrition report', async () => {
    const reportToDelete = testReportIds[0];
    await deleteNutritionReport(reportToDelete);

    const allReports = await getNutritionReportsByClientId(TEST_CLIENT_ID);
    const deletedReport = allReports.find(r => r.id === reportToDelete);
    expect(deletedReport).toBeUndefined();
  });

  // Cleanup: Delete any test reports created during this test run
  afterAll(async () => {
    // Delete all test reports
    for (const reportId of testReportIds) {
      try {
        await deleteNutritionReport(reportId);
      } catch (error) {
        // Ignore errors if already deleted
      }
    }
  });
});
