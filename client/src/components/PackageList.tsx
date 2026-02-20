import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Package, User } from "lucide-react";

interface PackageListProps {
  trainerId: number;
}

export function PackageList({ trainerId }: PackageListProps) {
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: allPackages, isLoading } = trpc.sessionPackages.getByClient.useQuery(
    { clientId: 0 }, // We'll fetch all packages and filter by trainer
    { enabled: false } // Disable automatic query, we'll fetch per client
  );

  // Fetch packages for all clients
  const clientPackages = clients?.map((client) => {
    const { data: packages } = trpc.sessionPackages.getByClient.useQuery({
      clientId: client.id,
    });
    return { client, packages: packages || [] };
  });

  // Filter to show only active packages (with remaining sessions)
  const activePackages = clientPackages
    ?.flatMap(({ client, packages }) =>
      packages
        .filter((pkg) => pkg.sessionsRemaining > 0)
        .map((pkg) => ({ ...pkg, clientName: client.name }))
    )
    .sort((a, b) => {
      // Sort by client name, then by creation date
      if (a.clientName < b.clientName) return -1;
      if (a.clientName > b.clientName) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Packages</CardTitle>
          <CardDescription>Loading packages...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!activePackages || activePackages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Packages</CardTitle>
          <CardDescription>No active packages found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create a package above to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group packages by client
  const packagesByClient = activePackages.reduce((acc, pkg) => {
    if (!acc[pkg.clientName]) {
      acc[pkg.clientName] = [];
    }
    acc[pkg.clientName].push(pkg);
    return acc;
  }, {} as Record<string, typeof activePackages>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Packages</CardTitle>
        <CardDescription>
          Showing {activePackages.length} active package{activePackages.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(packagesByClient).map(([clientName, packages]) => (
          <div key={clientName} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              {clientName}
            </div>
            <div className="space-y-3 pl-6">
              {packages.map((pkg) => {
                const usedSessions = pkg.sessionsTotal - pkg.sessionsRemaining;
                const progressPercent = (usedSessions / pkg.sessionsTotal) * 100;
                const isExpiringSoon =
                  pkg.expiryDate &&
                  new Date(pkg.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000; // 30 days

                return (
                  <div
                    key={pkg.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{pkg.packageType}</span>
                        </div>
                        {pkg.expiryDate && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Expires: {new Date(pkg.expiryDate).toLocaleDateString()}
                            {isExpiringSoon && (
                              <Badge variant="destructive" className="ml-2">
                                Expiring Soon
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {pkg.sessionsRemaining} / {pkg.sessionsTotal} left
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>
                          {usedSessions} of {pkg.sessionsTotal} used
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    {pkg.notes && (
                      <p className="text-xs text-muted-foreground">{pkg.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
