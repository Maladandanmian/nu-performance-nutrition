/**
 * Email Service Tests
 * 
 * Tests the email sending functionality using Nodemailer with SMTP.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendEmail, sendPasswordSetupInvitation, sendEmailVerification } from './emailService';

describe('Email Service', () => {
  beforeEach(() => {
    // Set up environment variables for testing
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASSWORD = 'test-password';
    process.env.EMAIL_FROM = 'Nu Performance <noreply@nunutrition.com>';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_PORT;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASSWORD;
    delete process.env.EMAIL_FROM;
  });

  describe('Email configuration validation', () => {
    it('should return false when EMAIL_HOST is missing', async () => {
      delete process.env.EMAIL_HOST;
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(result).toBe(false);
    });

    it('should return false when EMAIL_PORT is missing', async () => {
      delete process.env.EMAIL_PORT;
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(result).toBe(false);
    });

    it('should return false when EMAIL_USER is missing', async () => {
      delete process.env.EMAIL_USER;
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(result).toBe(false);
    });

    it('should return false when EMAIL_PASSWORD is missing', async () => {
      delete process.env.EMAIL_PASSWORD;
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(result).toBe(false);
    });
  });

  describe('sendPasswordSetupInvitation', () => {
    it('should generate password setup invitation email without crashing', async () => {
      // This test verifies the email service can be called without errors
      const result = await sendPasswordSetupInvitation(
        'test@example.com',
        'Test Client',
        'https://example.com/setup/test-token-12345'
      );

      // Should return false when email config is incomplete (in test environment)
      expect(typeof result).toBe('boolean');
    });

    it('should handle email sending gracefully when not configured', async () => {
      // Verify that missing email configuration doesn't crash the app
      delete process.env.EMAIL_HOST;
      const result = await sendPasswordSetupInvitation(
        'another-test@example.com',
        'Another Test Client',
        'https://example.com/setup/another-token-67890'
      );

      // Should return false when email is not configured
      expect(result).toBe(false);
    });
  });

  describe('sendEmailVerification', () => {
    it('should send email verification without crashing', async () => {
      const result = await sendEmailVerification(
        'verify@example.com',
        'Verify Test',
        'https://example.com/verify/token123'
      );
      expect(typeof result).toBe('boolean');
    });

    it('should handle missing email configuration', async () => {
      delete process.env.EMAIL_HOST;
      const result = await sendEmailVerification(
        'verify@example.com',
        'Verify Test',
        'https://example.com/verify/token456'
      );
      expect(result).toBe(false);
    });
  });
});
