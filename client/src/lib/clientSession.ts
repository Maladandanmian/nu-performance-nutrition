// Client session storage key
const CLIENT_SESSION_KEY = 'nu_client_session';

// Session lifetime must match the server-side cookie maxAge (7 days)
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Decode a base64 session token and return the payload, or null if invalid.
 */
function decodeToken(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch {
    return null;
  }
}

/**
 * Return the stored session token only if it exists and has not expired.
 * Automatically clears stale tokens so the app never acts on an expired session.
 */
export function getClientSessionFromStorage(): string | null {
  try {
    const token = localStorage.getItem(CLIENT_SESSION_KEY);
    if (!token) return null;

    const payload = decodeToken(token);
    if (!payload) {
      // Corrupt token — clear it
      localStorage.removeItem(CLIENT_SESSION_KEY);
      return null;
    }

    // Check expiry if present
    if (typeof payload.expiresAt === 'number' && Date.now() > payload.expiresAt) {
      localStorage.removeItem(CLIENT_SESSION_KEY);
      return null;
    }

    // Legacy tokens (no expiresAt) — treat as valid but add expiry on next write
    return token;
  } catch {
    return null;
  }
}

/**
 * Store the session token in localStorage with an explicit expiry timestamp.
 * The original base64 payload is re-encoded with expiresAt added so the server
 * can still decode it without changes.
 */
export function setClientSessionInStorage(session: string): void {
  try {
    const payload = decodeToken(session);
    if (!payload) {
      // Store as-is if we cannot decode (shouldn't happen in practice)
      localStorage.setItem(CLIENT_SESSION_KEY, session);
      return;
    }

    // Stamp with expiry matching the server cookie lifetime
    const stamped = { ...payload, expiresAt: Date.now() + SESSION_DURATION_MS };
    const newToken = btoa(JSON.stringify(stamped));
    localStorage.setItem(CLIENT_SESSION_KEY, newToken);
  } catch {
    console.warn('Failed to store client session in localStorage');
  }
}

/**
 * Remove the session token from localStorage.
 */
export function clearClientSessionFromStorage(): void {
  try {
    localStorage.removeItem(CLIENT_SESSION_KEY);
  } catch {
    console.warn('Failed to clear client session from localStorage');
  }
}
