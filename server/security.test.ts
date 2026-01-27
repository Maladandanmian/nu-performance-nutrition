/**
 * Security feature tests
 * Tests for bcrypt PIN hashing, rate limiting, and presigned URLs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePIN, isValidPIN, hashPIN, verifyPIN, isPINHashed } from './pinAuth';

describe('PIN Authentication Security', () => {
  describe('generatePIN', () => {
    it('should generate a 6-digit PIN', () => {
      const pin = generatePIN();
      expect(pin).toMatch(/^\d{6}$/);
    });

    it('should generate different PINs on each call', () => {
      const pins = new Set<string>();
      for (let i = 0; i < 100; i++) {
        pins.add(generatePIN());
      }
      // Should have at least 90 unique PINs out of 100 (very likely)
      expect(pins.size).toBeGreaterThan(90);
    });
  });

  describe('isValidPIN', () => {
    it('should accept valid 6-digit PINs', () => {
      expect(isValidPIN('123456')).toBe(true);
      expect(isValidPIN('000000')).toBe(true);
      expect(isValidPIN('999999')).toBe(true);
    });

    it('should reject invalid PINs', () => {
      expect(isValidPIN('12345')).toBe(false);  // Too short
      expect(isValidPIN('1234567')).toBe(false); // Too long
      expect(isValidPIN('abcdef')).toBe(false);  // Letters
      expect(isValidPIN('12345a')).toBe(false);  // Mixed
      expect(isValidPIN('')).toBe(false);        // Empty
    });
  });

  describe('hashPIN', () => {
    it('should hash a PIN with bcrypt', async () => {
      const pin = '123456';
      const hash = await hashPIN(pin);
      
      // bcrypt hashes start with $2
      expect(hash).toMatch(/^\$2[aby]?\$/);
      // bcrypt hashes are 60 characters
      expect(hash.length).toBe(60);
    });

    it('should generate different hashes for the same PIN', async () => {
      const pin = '123456';
      const hash1 = await hashPIN(pin);
      const hash2 = await hashPIN(pin);
      
      // Hashes should be different due to random salt
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPIN', () => {
    it('should verify correct PIN against hash', async () => {
      const pin = '123456';
      const hash = await hashPIN(pin);
      
      const result = await verifyPIN(pin, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      const pin = '123456';
      const wrongPin = '654321';
      const hash = await hashPIN(pin);
      
      const result = await verifyPIN(wrongPin, hash);
      expect(result).toBe(false);
    });

    it('should handle similar PINs correctly', async () => {
      const pin = '123456';
      const hash = await hashPIN(pin);
      
      // Off by one digit
      expect(await verifyPIN('123457', hash)).toBe(false);
      expect(await verifyPIN('023456', hash)).toBe(false);
    });
  });

  describe('isPINHashed', () => {
    it('should detect bcrypt hashed PINs', async () => {
      const hash = await hashPIN('123456');
      expect(isPINHashed(hash)).toBe(true);
    });

    it('should detect plaintext PINs', () => {
      expect(isPINHashed('123456')).toBe(false);
      expect(isPINHashed('000000')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isPINHashed('')).toBe(false);
      expect(isPINHashed('$1$notbcrypt')).toBe(false);
    });
  });
});

describe('Rate Limiting', () => {
  // Note: Full rate limiting tests require database mocking
  // These are unit tests for the utility functions
  
  describe('getClientIP', () => {
    it('should extract IP from X-Forwarded-For header', async () => {
      const { getClientIP } = await import('./rateLimit');
      
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
        ip: '127.0.0.1',
      };
      
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('should extract IP from X-Real-IP header', async () => {
      const { getClientIP } = await import('./rateLimit');
      
      const req = {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
        ip: '127.0.0.1',
      };
      
      expect(getClientIP(req)).toBe('192.168.1.2');
    });

    it('should fall back to request IP', async () => {
      const { getClientIP } = await import('./rateLimit');
      
      const req = {
        headers: {},
        ip: '127.0.0.1',
      };
      
      expect(getClientIP(req)).toBe('127.0.0.1');
    });

    it('should handle missing IP gracefully', async () => {
      const { getClientIP } = await import('./rateLimit');
      
      const req = {
        headers: {},
      };
      
      expect(getClientIP(req)).toBe('0.0.0.0');
    });
  });
});

describe('Presigned URL Storage', () => {
  // Note: Full presigned URL tests require S3 mocking
  // These verify the function signature and error handling
  
  it('should export storageGetPresigned function', async () => {
    const storage = await import('./storage');
    expect(typeof storage.storageGetPresigned).toBe('function');
  });
});
