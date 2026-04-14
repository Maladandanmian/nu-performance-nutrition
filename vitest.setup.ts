/**
 * Global Vitest Setup
 * 
 * This file is run before all tests and sets up global mocks and configuration.
 * It prevents real emails from being sent during test runs.
 */

import { vi } from 'vitest';

// Mock the email service globally to prevent sending real emails during tests
vi.mock('./server/emailService', () => ({
  sendPasswordSetupInvitation: vi.fn().mockResolvedValue(true),
  sendEmailVerification: vi.fn().mockResolvedValue(true),
  sendEmail: vi.fn().mockResolvedValue(true),
}));
