import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PackageSelectorProps {
  clientId: number;
  selectedPackageId?: number;
  onSelectPackage: (packageId: number | undefined) => void;
}

export function PackageSelector({
  clientId,
  selectedPackageId,
  onSelectPackage,
}: PackageSelectorProps) {
  const { data: packages, isLoading } = trpc.sessionPackages.getByClient.useQuery({
    clientId,
  });

  // Filter to show only active packages (with remaining sessions)
  const activePackages = packages?.filter((pkg) => pkg.sessionsRemaining > 0) || [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Select Package</Label>
        <div className="text-sm text-muted-foreground">Loading packages...</div>
      </div>
    );
  }

  if (activePackages.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This client has no active packages with remaining sessions. Please create a
          package first or change payment status to "Paid" or "Unpaid".
        </AlertDescription>
      </Alert>
    );
  }

  const selectedPackage = activePackages.find((pkg) => pkg.id === selectedPackageId);

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <Label htmlFor="package">Select Package *</Label>
      </div>

      <Select
        value={selectedPackageId?.toString() || ""}
        onValueChange={(value) => onSelectPackage(value ? parseInt(value) : undefined)}
      >
        <SelectTrigger id="package">
          <SelectValue placeholder="Choose a package" />
        </SelectTrigger>
        <SelectContent>
          {activePackages.map((pkg) => (
            <SelectItem key={pkg.id} value={pkg.id.toString()}>
              <div className="flex items-center justify-between gap-4">
                <span>{pkg.packageType}</span>
                <Badge variant="secondary" className="ml-2">
                  {pkg.sessionsRemaining} left
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPackage && (
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sessions remaining:</span>
            <span className="font-medium">
              {selectedPackage.sessionsRemaining} / {selectedPackage.sessionsTotal}
            </span>
          </div>
          {selectedPackage.expiryDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires:</span>
              <span className="font-medium">
                {new Date(selectedPackage.expiryDate).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            ✓ One session will be deducted from this package
          </div>
        </div>
      )}
    </div>
  );
}
