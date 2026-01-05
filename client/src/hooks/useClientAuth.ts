import { trpc } from '@/lib/trpc';

export function useClientAuth() {
  const { data: clientSession, isLoading: loading } = trpc.auth.clientSession.useQuery();
  const logoutMutation = trpc.auth.logoutClient.useMutation();

  const logout = async () => {
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
