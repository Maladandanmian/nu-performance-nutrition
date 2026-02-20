import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function PackageCreationForm() {
  const [clientId, setClientId] = useState<string>("");
  const [packageType, setPackageType] = useState<string>("");
  const [sessionsTotal, setSessionsTotal] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: clients } = trpc.clients.list.useQuery();
  
  const createPackageMutation = trpc.sessionPackages.create.useMutation({
    onSuccess: () => {
      toast.success("Package created successfully");
      // Reset form
      setClientId("");
      setPackageType("");
      setSessionsTotal("");
      setTotalPrice("");
      setExpiryDate("");
      setNotes("");
      // Invalidate packages query to refresh the list
      utils.sessionPackages.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create package: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId || !packageType || !sessionsTotal) {
      toast.error("Please fill in all required fields");
      return;
    }

    const sessions = parseInt(sessionsTotal);
    if (isNaN(sessions) || sessions <= 0) {
      toast.error("Sessions must be a positive number");
      return;
    }

    // Build package type string with price if provided
    let packageTypeStr = packageType;
    if (totalPrice) {
      packageTypeStr += ` - $${totalPrice}`;
    }

    createPackageMutation.mutate({
      clientId: parseInt(clientId),
      packageType: packageTypeStr,
      sessionsTotal: sessions,
      purchaseDate: new Date().toISOString().split("T")[0], // Today's date
      expiryDate: expiryDate || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Session Package</CardTitle>
        <CardDescription>
          Create a pre-purchased session package for a client
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="packageType">Package Type *</Label>
            <Select value={packageType} onValueChange={setPackageType}>
              <SelectTrigger id="packageType">
                <SelectValue placeholder="Select package type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1on1_pt">1-on-1 Personal Training</SelectItem>
                <SelectItem value="2on1_pt">2-on-1 Personal Training</SelectItem>
                <SelectItem value="nutrition_coaching">Nutrition Coaching</SelectItem>
                <SelectItem value="nutrition_initial">Initial Nutrition Consultation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionsTotal">Number of Sessions *</Label>
              <Input
                id="sessionsTotal"
                type="number"
                min="1"
                placeholder="e.g., 10"
                value={sessionsTotal}
                onChange={(e) => setSessionsTotal(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalPrice">Total Price (Optional)</Label>
              <Input
                id="totalPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 1000"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
            <Input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this package..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createPackageMutation.isPending}
          >
            {createPackageMutation.isPending ? "Creating..." : "Create Package"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
