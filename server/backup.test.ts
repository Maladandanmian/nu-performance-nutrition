import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAndEmailBackup } from './backup';
import * as db from './db';

// Mock the db module
vi.mock('./db', () => ({
  getDb: vi.fn(),
  createBackupLog: vi.fn(),
}));

// Mock nodemailer
const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

describe('Backup System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    // Set required environment variables
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASSWORD = 'password';
    process.env.EMAIL_FROM = 'noreply@test.com';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create backup successfully when all tables are available', async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => Promise.resolve([])),
      })),
    };

    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.createBackupLog).mockResolvedValue(undefined);

    const result = await createAndEmailBackup('test@example.com', 1);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Backup completed');
    expect(vi.mocked(db.createBackupLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        trainerId: 1,
      })
    );
  });

  it('should handle individual table query failures gracefully with allSettled', async () => {
    // Create a mock that fails for one table but succeeds for others
    let callCount = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(async () => {
          callCount++;
          // Fail on the 3rd call (simulating a slow/failed query)
          if (callCount === 3) {
            throw new Error('Query timeout on nutritionGoals');
          }
          return [];
        }),
      })),
    };

    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.createBackupLog).mockResolvedValue(undefined);

    // Should not throw, should complete with fallback empty arrays
    const result = await createAndEmailBackup('test@example.com', 1);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Backup completed');
    expect(vi.mocked(db.createBackupLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        trainerId: 1,
      })
    );
  });

  it('should log backup with fallback trainer ID when trainerId is not provided', async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => Promise.resolve([])),
      })),
    };

    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.createBackupLog).mockResolvedValue(undefined);

    await createAndEmailBackup('test@example.com');

    expect(vi.mocked(db.createBackupLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        trainerId: 1, // Fallback to 1
      })
    );
  });

  it('should handle database connection failure', async () => {
    vi.mocked(db.getDb).mockResolvedValue(null);
    vi.mocked(db.createBackupLog).mockResolvedValue(undefined);

    const result = await createAndEmailBackup('test@example.com', 1);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Database not available');
    expect(vi.mocked(db.createBackupLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        trainerId: 1,
      })
    );
  });

  it('should calculate backup file size correctly', async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => Promise.resolve([{ id: 1, name: 'test' }])),
      })),
    };

    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.createBackupLog).mockResolvedValue(undefined);

    await createAndEmailBackup('test@example.com', 1);

    // Verify that file size was calculated and logged
    expect(vi.mocked(db.createBackupLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        fileSizeKB: expect.any(Number),
        status: 'success',
      })
    );

    const callArgs = vi.mocked(db.createBackupLog).mock.calls[0][0];
    expect(callArgs.fileSizeKB).toBeGreaterThan(0);
  });

  it('should include recipient email in backup log', async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => Promise.resolve([])),
      })),
    };

    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.createBackupLog).mockResolvedValue(undefined);

    const testEmail = 'luke@example.com';
    await createAndEmailBackup(testEmail, 1);

    expect(vi.mocked(db.createBackupLog)).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: testEmail,
      })
    );
  });

  it('should not throw when backup log creation fails', async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => Promise.resolve([])),
      })),
    };

    vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
    vi.mocked(db.createBackupLog).mockRejectedValue(new Error('Log write failed'));

    // Should not throw, should still return success
    const result = await createAndEmailBackup('test@example.com', 1);

    expect(result.success).toBe(true);
  });
});
