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
import { hashPIN } from './pinAuth';
import { hashPassword, verifyPassword } from './emailAuth';

describe('Client Invitation and Password Setup', () => {
  let testTrainerId: number;
  let testClientId: number;
  let passwordSetupToken: string;
  const testClientEmail = 'test-client-invitation@example.com';
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
    // Cleanup: delete test client and trainer
    if (testClientId) {
      await db.deleteClientAndData(testClientId);
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
