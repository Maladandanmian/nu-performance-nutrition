/**
 * Email Service Tests
 * 
 * Tests the email sending functionality for password setup invitations.
 */

import { describe, it, expect } from 'vitest';
import { sendPasswordSetupInvitation } from './emailService';

describe('Email Service', () => {
  it('should generate password setup invitation email without crashing', async () => {
    // This test verifies the email service can be called without errors
    // When email is not configured, it should log to console and return false
    const result = await sendPasswordSetupInvitation(
      'test@example.com',
      'Test Client',
      'test-token-12345'
    );

    // Without email configuration, should return false
    expect(typeof result).toBe('boolean');
  });

  it('should handle email sending gracefully when not configured', async () => {
    // Verify that missing email configuration doesn't crash the app
    const result = await sendPasswordSetupInvitation(
      'another-test@example.com',
      'Another Test Client',
      'another-token-67890'
    );

    // Should return false when email is not configured
    expect(result).toBe(false);
  });
});
