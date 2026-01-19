import { trpc } from '@/lib/trpc';
import { clearClientSessionFromStorage } from '@/lib/clientSession';

export function useClientAuth() {
  const { data: clientSession, isLoading: loading } = trpc.auth.clientSession.useQuery();
  const logoutMutation = trpc.auth.logoutClient.useMutation();

  // Debug logging
  console.log('[useClientAuth] clientSession:', clientSession, 'loading:', loading);

  const logout = async () => {
    // Clear localStorage session
    clearClientSessionFromStorage();
    console.log('[useClientAuth] Cleared localStorage session');
    
    await logoutMutation.mutateAsync();
    // Force a full page reload to ensure cookies are cleared
    window.location.href = '/';
    window.location.reload();
  };

  return {
    clientSession: clientSession || null,
    loading,
    isAuthenticated: !!clientSession,
    logout,
  };
}
