import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashPassword, verifyPassword, generateSecureToken, isValidEmail, isStrongPassword } from './emailAuth';
import { getDb, getClientByEmail, updateClientPassword, deleteClient } from './db';
import { logAuditEvent, getAuditLogs } from './auditLog';
import { clients, auditLogs, users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Email Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePass123!';
      const wrongPassword = 'WrongPass456!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SecurePass123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // Different salts
    });
  });

  describe('Token Generation', () => {
    it('should generate secure random token', () => {
      const token = generateSecureToken();
      
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@gmail.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('Password Strength Validation', () => {
    it('should accept strong passwords', () => {
      expect(isStrongPassword('SecurePass123!')).toBe(true);
      expect(isStrongPassword('MyP@ssw0rd!')).toBe(true);
      expect(isStrongPassword('Abcd1234!')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(isStrongPassword('short')).toBe(false); // Too short
      expect(isStrongPassword('alllowercase1!')).toBe(false); // No uppercase
      expect(isStrongPassword('ALLUPPERCASE1!')).toBe(false); // No lowercase
      expect(isStrongPassword('NoNumbers!')).toBe(false); // No numbers
    });
  });
});

describe('Audit Logging', () => {
  const testActorId = 999999; // Use a high ID unlikely to conflict
  
  afterAll(async () => {
    // Clean up test audit logs
    const db = await getDb();
    if (db) {
      await db.delete(auditLogs).where(eq(auditLogs.actorId, testActorId));
    }
  });

  it('should log audit events', async () => {
    await logAuditEvent({
      actorType: 'client',
      actorId: testActorId,
      action: 'login_email',
      details: { method: 'email', ip: '127.0.0.1' },
      ipAddress: '127.0.0.1'
    });

    const logs = await getAuditLogs(testActorId, 10);
    expect(logs.length).toBeGreaterThan(0);
    
    const latestLog = logs[0];
    expect(latestLog.action).toBe('login_email');
    expect(latestLog.actorId).toBe(testActorId);
  });

  it('should store details as JSON', async () => {
    const details = { test: 'value', nested: { key: 'data' } };
    
    await logAuditEvent({
      actorType: 'client',
      actorId: testActorId,
      action: 'password_change',
      details,
      ipAddress: '192.168.1.1'
    });

    const logs = await getAuditLogs(testActorId, 10);
    const testLog = logs.find(l => l.action === 'password_change');
    
    expect(testLog).toBeDefined();
    expect(testLog?.details).toEqual(JSON.stringify(details));
  });
});

describe('Client Email Authentication Flow', () => {
  let testClientId: number;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';
  const testPin = '999998'; // Use unique PIN to avoid conflicts

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available for testing');
    
    // First, get or create a test trainer
    const trainers = await db.select().from(users).limit(1);
    if (trainers.length === 0) {
      throw new Error('No trainers in database for testing');
    }
    const trainerId = trainers[0].id;
    
    // Hash the password before creating client
    const passwordHash = await hashPassword(testPassword);
    const hashedPin = await hashPassword(testPin);
    
    // Create a test client with email
    const result = await db.insert(clients).values({
      name: 'Email Test Client',
      pin: hashedPin,
      trainerId: trainerId,
      email: testEmail.toLowerCase(),
      passwordHash: passwordHash,
      authMethod: 'email',
      emailVerified: false,
    });
    testClientId = Number(result[0].insertId);
  });

  afterAll(async () => {
    // Clean up test client and related data
    if (testClientId) {
      const db = await getDb();
      if (db) {
        await db.delete(auditLogs).where(eq(auditLogs.actorId, testClientId));
      }
      await deleteClient(testClientId);
    }
  });

  it('should create client with hashed password', async () => {
    const client = await getClientByEmail(testEmail);
    
    expect(client).toBeDefined();
    expect(client?.email).toBe(testEmail);
    expect(client?.passwordHash).toBeDefined();
    expect(client?.passwordHash?.startsWith('$2')).toBe(true);
    expect(client?.passwordHash).not.toBe(testPassword);
  });

  it('should verify client password correctly', async () => {
    const client = await getClientByEmail(testEmail);
    
    if (client?.passwordHash) {
      const isValid = await verifyPassword(testPassword, client.passwordHash);
      expect(isValid).toBe(true);
      
      const isInvalid = await verifyPassword('WrongPassword!', client.passwordHash);
      expect(isInvalid).toBe(false);
    }
  });

  it('should update client password', async () => {
    const newPassword = 'NewSecurePass456!';
    const newHash = await hashPassword(newPassword);
    
    await updateClientPassword(testClientId, newHash);
    
    const client = await getClientByEmail(testEmail);
    if (client?.passwordHash) {
      const isValid = await verifyPassword(newPassword, client.passwordHash);
      expect(isValid).toBe(true);
    }
  });
});
