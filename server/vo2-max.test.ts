import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from './routers';
import type { Context } from './_core/context';

// Mock context for testing
const mockContext: Context = {
  user: {
    id: 1,
    openId: 'test-open-id',
    name: 'Test Trainer',
    email: 'trainer@test.com',
    role: 'admin',
    loginMethod: 'google',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
};

describe('VO2 Max Tests', () => {
  const caller = appRouter.createCaller(mockContext);
  let testClientId: number;

  beforeAll(async () => {
    // Create a test client with unique email
    const uniqueEmail = `vo2test-${Date.now()}@example.com`;
    const result = await caller.clients.create({
      name: 'VO2 Max Test Client',
      email: uniqueEmail,
    });
    testClientId = result.clientId;
  });

  it('should retrieve empty VO2 Max tests for new client', async () => {
    const tests = await caller.vo2MaxTests.getAll({ clientId: testClientId });
    expect(tests).toEqual([]);
  });

  it('should upload a VO2 Max test PDF', async () => {
    // Create a mock PDF buffer
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');
    const base64Pdf = mockPdfBuffer.toString('base64');

    const result = await caller.vo2MaxTests.upload({
      clientId: testClientId,
      testDate: new Date('2024-01-15'),
      filename: 'test-vo2-max.pdf',
      fileData: base64Pdf,
    });

    expect(result.success).toBe(true);
    expect(result.testId).toBeGreaterThan(0);
  });

  it('should retrieve uploaded VO2 Max tests', async () => {
    const tests = await caller.vo2MaxTests.getAll({ clientId: testClientId });
    expect(tests.length).toBeGreaterThan(0);
    expect(tests[0]).toHaveProperty('id');
    expect(tests[0]).toHaveProperty('testDate');
    expect(tests[0]).toHaveProperty('pdfUrl');
  });

  it('should update ambient data for a VO2 Max test', async () => {
    // First upload a test
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');
    const base64Pdf = mockPdfBuffer.toString('base64');
    const uploadResult = await caller.vo2MaxTests.upload({
      clientId: testClientId,
      testDate: new Date('2024-01-20'),
      filename: 'test-update.pdf',
      fileData: base64Pdf,
    });
    const testId = uploadResult.testId;

    // Update ambient data
    const updateResult = await caller.vo2MaxTests.updateAmbientData({
      testId,
      temperature: '25.5',
      pressure: '760',
      humidity: '65',
    });
    expect(updateResult.success).toBe(true);

    // Verify the update
    const testDetails = await caller.vo2MaxTests.getTestDetails({ testId });
    expect(testDetails.ambientData?.temperature).toBe('25.5');
    expect(testDetails.ambientData?.pressure).toBe(760);
    expect(testDetails.ambientData?.humidity).toBe(65);
  });

  it('should update anthropometric data for a VO2 Max test', async () => {
    const tests = await caller.vo2MaxTests.getAll({ clientId: testClientId });
    const testId = tests[0].id;

    // Update anthropometric data
    const updateResult = await caller.vo2MaxTests.updateAnthropometric({
      testId,
      height: '1.85',
      weight: '75.5',
      restingHr: 55,
    });
    expect(updateResult.success).toBe(true);

    // Verify the update
    const testDetails = await caller.vo2MaxTests.getTestDetails({ testId });
    expect(testDetails.anthropometric?.height).toBe('1.85');
    expect(testDetails.anthropometric?.weight).toBe('75.5');
    expect(testDetails.anthropometric?.restingHeartRate).toBe(55);
  });

  it('should update fitness assessment data for a VO2 Max test', async () => {
    const tests = await caller.vo2MaxTests.getAll({ clientId: testClientId });
    const testId = tests[0].id;

    // Update fitness assessment data
    const updateResult = await caller.vo2MaxTests.updateFitnessAssessment({
      testId,
      aerobicThresholdLactate: '2.0',
      aerobicThresholdSpeed: '12.0',
      aerobicThresholdHr: 150,
      lactateThresholdLactate: '4.0',
      lactateThresholdSpeed: '14.0',
      lactateThresholdHr: 170,
      maximumLactate: '8.5',
      maximumSpeed: '16.0',
      maximumHr: 190,
      vo2MaxMlKgMin: '55.0',
      vo2MaxLMin: '4.2',
    });
    expect(updateResult.success).toBe(true);

    // Verify the update (use parseFloat for decimal comparisons)
    const testDetails = await caller.vo2MaxTests.getTestDetails({ testId });
    expect(parseFloat(testDetails.fitnessAssessment?.aerobicThresholdLactate || '0')).toBe(2.0);
    expect(parseFloat(testDetails.fitnessAssessment?.aerobicThresholdSpeed || '0')).toBe(12.0);
    expect(testDetails.fitnessAssessment?.aerobicThresholdHr).toBe(150);
    expect(parseFloat(testDetails.fitnessAssessment?.lactateThresholdLactate || '0')).toBe(4.0);
    expect(parseFloat(testDetails.fitnessAssessment?.lactateThresholdSpeed || '0')).toBe(14.0);
    expect(testDetails.fitnessAssessment?.lactateThresholdHr).toBe(170);
    expect(parseFloat(testDetails.fitnessAssessment?.maximumLactate || '0')).toBe(8.5);
    expect(parseFloat(testDetails.fitnessAssessment?.maximumSpeed || '0')).toBe(16.0);
    expect(testDetails.fitnessAssessment?.maximumHr).toBe(190);
    expect(parseFloat(testDetails.fitnessAssessment?.vo2MaxMlKgMin || '0')).toBe(55.0);
    expect(parseFloat(testDetails.fitnessAssessment?.vo2MaxLMin || '0')).toBe(4.2);
  });

  it('should delete a VO2 Max test', async () => {
    const tests = await caller.vo2MaxTests.getAll({ clientId: testClientId });
    const testId = tests[0].id;

    const result = await caller.vo2MaxTests.delete({ testId });
    expect(result.success).toBe(true);

    // Verify deletion
    const remainingTests = await caller.vo2MaxTests.getAll({ clientId: testClientId });
    expect(remainingTests.length).toBe(tests.length - 1);
  });
});
