/**
 * Session Management Utilities
 * Handles JWT token generation, validation, and refresh
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '1h'; // 1 hour
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

export interface SessionPayload {
  type: 'client' | 'trainer';
  id: number;
  name: string;
  authMethod: 'pin' | 'email';
  sessionId: string; // Unique session identifier for revocation
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a new token pair for a client session
 */
export function createClientSession(
  clientId: number,
  clientName: string,
  authMethod: 'pin' | 'email'
): TokenPair {
  const sessionId = generateSessionId();
  
  const payload: SessionPayload = {
    type: 'client',
    id: clientId,
    name: clientName,
    authMethod,
    sessionId,
  };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'nu-performance-nutrition',
    audience: 'client',
  });
  
  const refreshToken = jwt.sign(
    { ...payload, tokenType: 'refresh' },
    JWT_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'nu-performance-nutrition',
      audience: 'client',
    }
  );
  
  return {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1 hour in seconds
  };
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'nu-performance-nutrition',
      audience: 'client',
    }) as SessionPayload;
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'nu-performance-nutrition',
      audience: 'client',
    }) as SessionPayload & { tokenType: string };
    
    if (decoded.tokenType !== 'refresh') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Refresh an access token using a refresh token
 */
export function refreshAccessToken(refreshToken: string): TokenPair | null {
  const payload = verifyRefreshToken(refreshToken);
  
  if (!payload) {
    return null;
  }
  
  // Create new token pair with same session ID
  const newAccessToken = jwt.sign(
    {
      type: payload.type,
      id: payload.id,
      name: payload.name,
      authMethod: payload.authMethod,
      sessionId: payload.sessionId,
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'nu-performance-nutrition',
      audience: 'client',
    }
  );
  
  // Return same refresh token (it's still valid)
  return {
    accessToken: newAccessToken,
    refreshToken,
    expiresIn: 3600,
  };
}

/**
 * Extract session info from legacy base64 cookie (for backward compatibility)
 */
export function parseLegacySession(cookieValue: string): {
  clientId: number;
  name: string;
} | null {
  try {
    const decoded = JSON.parse(Buffer.from(cookieValue, 'base64').toString());
    if (decoded.clientId && decoded.name) {
      return {
        clientId: decoded.clientId,
        name: decoded.name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a legacy-compatible session cookie value
 * Used during transition period to support both old and new clients
 */
export function createLegacySessionCookie(
  clientId: number,
  name: string,
  authMethod: 'pin' | 'email'
): string {
  const sessionData = JSON.stringify({
    clientId,
    name,
    type: 'client',
    authMethod,
    timestamp: Date.now(),
  });
  
  return Buffer.from(sessionData).toString('base64');
}
