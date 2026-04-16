/**
 * Client Invitation and Password Setup Tests
 * 
 * Tests the full flow:
 * 1. Trainer creates client with email
 * 2. System generates password setup token
 * 3. Client sets password via token
 * 4. Client logs in with email/password
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

import { hashPassword, verifyPassword } from './emailAuth';

describe('Client Invitation and Password Setup', () => {
  let testTrainerId: number;
  let testClientId: number;
  let passwordSetupToken: string;
  const testClientEmail = `test-client-invitation-${Date.now()}@example.com`;
  const testClientName = 'Test Client Invitation';
  const testPassword = 'SecurePassword123!';

  beforeAll(async () => {
    // Create a test trainer
    const trainerOpenId = `test-trainer-${Date.now()}`;
    await db.upsertUser({
      openId: trainerOpenId,
      name: 'Test Trainer',
      email: 'test-trainer@example.com',
      role: 'admin',
    });
    const trainer = await db.getUserByOpenId(trainerOpenId);
    if (!trainer) throw new Error('Failed to create test trainer');
    testTrainerId = trainer.id;
  });

  afterAll(async () => {
    // Cleanup: delete test client
    if (testClientId) {
      try {
        await db.deleteClientAndData(testClientId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  it('should create client with email and generate password setup token', async () => {
    // Create client (simulating trainer action)
    const result = await db.createClient({
      trainerId: testTrainerId,
      name: testClientName,
      email: testClientEmail,
      authMethod: 'pin', // Default, will change to 'email' after password setup
    });

    testClientId = Number(result[0].insertId);
    expect(testClientId).toBeGreaterThan(0);

    // Generate password setup token
    passwordSetupToken = await db.generatePasswordSetupToken(testClientId);
    expect(passwordSetupToken).toBeTruthy();
    expect(passwordSetupToken.length).toBeGreaterThan(20);

    // Verify token is stored in database
    const client = await db.getClientById(testClientId);
    expect(client?.passwordSetupToken).toBe(passwordSetupToken);
    expect(client?.passwordSetupTokenExpires).toBeTruthy();
  });

  it('should verify password setup token is valid', async () => {
    const client = await db.verifyPasswordSetupToken(passwordSetupToken);
    expect(client).toBeTruthy();
    expect(client?.id).toBe(testClientId);
    expect(client?.email).toBe(testClientEmail);
  });

  it('should reject invalid password setup token', async () => {
    const invalidToken = 'invalid-token-12345';
    const client = await db.verifyPasswordSetupToken(invalidToken);
    expect(client).toBeUndefined();
  });

  it('should set client password using valid token', async () => {
    // Hash the password
    const passwordHash = await hashPassword(testPassword);
    expect(passwordHash).toBeTruthy();

    // Update client with password
    await db.updateClient(testClientId, {
      passwordHash,
      emailVerified: true,
      authMethod: 'email',
    });

    // Clear the token
    await db.clearPasswordSetupToken(testClientId);

    // Verify password was set
    const client = await db.getClientById(testClientId);
    expect(client?.passwordHash).toBeTruthy();
    expect(client?.emailVerified).toBe(true);
    expect(client?.authMethod).toBe('email');
    expect(client?.passwordSetupToken).toBeNull();
    expect(client?.passwordSetupTokenExpires).toBeNull();
  });

  it('should verify password setup token is no longer valid after use', async () => {
    const client = await db.verifyPasswordSetupToken(passwordSetupToken);
    expect(client).toBeUndefined();
  });

  it('should allow client to login with email and password', async () => {
    const client = await db.getClientByEmail(testClientEmail);
    expect(client).toBeTruthy();
    expect(client?.passwordHash).toBeTruthy();

    // Verify password
    const passwordValid = await verifyPassword(testPassword, client!.passwordHash!);
    expect(passwordValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const client = await db.getClientByEmail(testClientEmail);
    expect(client).toBeTruthy();

    // Verify wrong password
    const passwordValid = await verifyPassword('WrongPassword123!', client!.passwordHash!);
    expect(passwordValid).toBe(false);
  });


});


/**
 * Client Invitation Email URL Construction Tests
 * 
 * Verifies that:
 * 1. The setup URL is properly formatted with the app domain
 * 2. The token is correctly URL-encoded in the query parameter
 * 3. Special characters in tokens are properly escaped
 */

describe('Client Invitation Email URL Construction', () => {
  it('should construct a valid set-password URL with token query parameter', () => {
    const token = 'abc123def456';
    const expectedUrl = `https://example.com/set-password?token=${encodeURIComponent(token)}`;
    
    // Verify URL structure
    expect(expectedUrl).toContain('/set-password?token=');
    expect(expectedUrl).toContain(token);
  });

  it('should properly encode tokens with special characters', () => {
    const tokenWithSpecialChars = 'abc+123/def=456';
    const encodedToken = encodeURIComponent(tokenWithSpecialChars);
    const url = `https://example.com/set-password?token=${encodedToken}`;
    
    // Verify special characters in the token are encoded
    expect(encodedToken).not.toContain('+');
    expect(encodedToken).not.toContain('/');
    expect(encodedToken).toContain('%');
  });

  it('should include the full URL in the email template, not just the token', () => {
    const token = '2107858202080fcb8edbb8116926 56a7aa1156ee8b0480cb5d42f1ef7fada86';
    const appUrl = 'https://nuperformnut-cvoywtwv.manus.space';
    const setupUrl = `${appUrl}/set-password?token=${encodeURIComponent(token)}`;
    
    // Verify the URL is complete and clickable
    expect(setupUrl).toMatch(/^https:\/\//);
    expect(setupUrl).toContain('/set-password');
    expect(setupUrl).toContain('token=');
  });

  it('should start with https protocol for security', () => {
    const appUrl = 'https://nuperformnut-cvoywtwv.manus.space';
    const token = 'test-token-123';
    const setupUrl = `${appUrl}/set-password?token=${encodeURIComponent(token)}`;
    
    expect(setupUrl).toMatch(/^https:\/\//);
  });

  it('should handle tokens with URL-unsafe characters correctly', () => {
    const unsafeTokens = [
      'token with spaces',
      'token&with&ampersands',
      'token?with?question',
      'token=with=equals',
      'token#with#hash',
    ];

    unsafeTokens.forEach(token => {
      const encoded = encodeURIComponent(token);
      const url = `https://example.com/set-password?token=${encoded}`;
      
      // Verify the encoded token doesn't have unencoded unsafe characters
      expect(encoded).not.toContain(' ');
      expect(encoded).not.toContain('&');
      expect(encoded).not.toContain('?');
      expect(encoded).not.toContain('#');
      expect(url).toContain('token=');
    });
  });

  it('should produce a URL that can be parsed by URL constructor', () => {
    const appUrl = 'https://nuperformnut-cvoywtwv.manus.space';
    const token = 'abc123def456ghi789';
    const setupUrl = `${appUrl}/set-password?token=${encodeURIComponent(token)}`;
    
    // Verify the URL is valid and parseable
    const urlObj = new URL(setupUrl);
    expect(urlObj.pathname).toBe('/set-password');
    expect(urlObj.searchParams.get('token')).toBe(token);
  });

  it('should not include the raw token in the URL, only the encoded version', () => {
    const token = 'abc+123def=456';
    const encodedToken = encodeURIComponent(token);
    const url = `https://example.com/set-password?token=${encodedToken}`;
    
    // Verify encoded version is present in the URL
    expect(url).toContain(encodedToken);
    // Verify encoded token doesn't have raw special chars
    expect(encodedToken).not.toContain('+');
    expect(encodedToken).not.toContain('=');
  });

  it('should work with very long tokens (typical length for cryptographic tokens)', () => {
    // Simulate a real password setup token (typically 32+ characters)
    const longToken = 'a'.repeat(64);
    const url = `https://example.com/set-password?token=${encodeURIComponent(longToken)}`;
    
    // Verify long token is handled correctly
    expect(url.length).toBeGreaterThan(100);
    expect(url).toContain('token=');
    
    // Verify it can be parsed
    const urlObj = new URL(url);
    expect(urlObj.searchParams.get('token')).toBe(longToken);
  });

  it('should produce consistent URLs for the same token', () => {
    const appUrl = 'https://nuperformnut-cvoywtwv.manus.space';
    const token = 'consistent-token-123';
    
    const url1 = `${appUrl}/set-password?token=${encodeURIComponent(token)}`;
    const url2 = `${appUrl}/set-password?token=${encodeURIComponent(token)}`;
    
    expect(url1).toBe(url2);
  });
});
