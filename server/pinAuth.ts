/**
 * PIN-based authentication utilities for client login
 * Now with bcrypt hashing for secure PIN storage
 */
import bcrypt from 'bcrypt';

// Cost factor for bcrypt (12 is recommended for production)
const BCRYPT_ROUNDS = 12;

/**
 * Generate a unique 6-digit PIN
 * @returns A 6-digit PIN string
 */
export function generatePIN(): string {
  // Generate a random 6-digit number
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  return pin;
}

/**
 * Validate PIN format
 * @param pin - The PIN to validate
 * @returns true if PIN is valid format (6 digits)
 */
export function isValidPIN(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Hash a PIN using bcrypt
 * @param pin - The plaintext PIN to hash
 * @returns The bcrypt hash of the PIN
 */
export async function hashPIN(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

/**
 * Verify a PIN against a bcrypt hash
 * @param pin - The plaintext PIN to verify
 * @param hash - The bcrypt hash to compare against
 * @returns true if the PIN matches the hash
 */
export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Check if a stored PIN is already hashed (bcrypt hashes start with $2)
 * @param storedPin - The stored PIN value
 * @returns true if the PIN is already hashed
 */
export function isPINHashed(storedPin: string): boolean {
  return storedPin.startsWith('$2');
}
