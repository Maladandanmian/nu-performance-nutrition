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
