// Client session storage key
const CLIENT_SESSION_KEY = 'nu_client_session';

// Helper to get client session from localStorage
export function getClientSessionFromStorage(): string | null {
  try {
    return localStorage.getItem(CLIENT_SESSION_KEY);
  } catch {
    return null;
  }
}

// Helper to set client session in localStorage
export function setClientSessionInStorage(session: string): void {
  try {
    localStorage.setItem(CLIENT_SESSION_KEY, session);
  } catch {
    console.warn('Failed to store client session in localStorage');
  }
}

// Helper to clear client session from localStorage
export function clearClientSessionFromStorage(): void {
  try {
    localStorage.removeItem(CLIENT_SESSION_KEY);
  } catch {
    console.warn('Failed to clear client session from localStorage');
  }
}
