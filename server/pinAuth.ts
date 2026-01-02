/**
 * PIN-based authentication utilities for client login
 */

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
