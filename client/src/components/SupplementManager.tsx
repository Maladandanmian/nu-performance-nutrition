import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

interface SupplementManagerProps {
  clientId: number;
}

export function SupplementManager({ clientId }: SupplementManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplementName, setNewSupplementName] = useState("");
  const [newSupplementDose, setNewSupplementDose] = useState("");

  // Fetch supplement templates
  const { data: templates = [], refetch } = trpc.supplements.getTemplates.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  // Create template mutation
  const createTemplateMutation = trpc.supplements.createTemplate.useMutation({
    onSuccess: () => {
      toast.success("Supplement added!");
      setIsAdding(false);
      setNewSupplementName("");
      setNewSupplementDose("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add supplement");
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = trpc.supplements.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Supplement removed");
      refetch();
    },
    onError: () => {
      toast.error("Failed to remove supplement");
    },
  });

  // Log supplement mutation
  const logSupplementMutation = trpc.supplements.logSupplement.useMutation({
    onSuccess: () => {
      toast.success("Supplement logged!");
    },
    onError: () => {
      toast.error("Failed to log supplement");
    },
  });

  const handleAddSupplement = () => {
    if (!newSupplementName.trim() || !newSupplementDose.trim()) {
      toast.error("Please enter both supplement name and dose");
      return;
    }

    createTemplateMutation.mutate({
      clientId,
      name: newSupplementName.trim(),
      dose: newSupplementDose.trim(),
    });
  };

  const handleLogSupplement = (template: any) => {
    logSupplementMutation.mutate({
      clientId,
      supplementTemplateId: template.id,
      name: template.name,
      dose: template.dose,
      loggedAt: new Date(),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>My Supplements</Label>
        <p className="text-xs text-gray-500 mt-1">
          Add up to 5 supplements you take regularly. Click to log them.
        </p>
      </div>

      {/* Supplement list */}
      {templates.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-4">No supplements added yet</p>
          <Button
            onClick={() => setIsAdding(true)}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Supplement
          </Button>
        </div>
      )}

      {templates.length > 0 && (
        <div className="grid gap-2">
          {templates.map((template: any) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-gray-500">{template.dose}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleLogSupplement(template)}
                      size="sm"
                      disabled={logSupplementMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Log
                    </Button>
                    <Button
                      onClick={() => deleteTemplateMutation.mutate({ id: template.id })}
                      variant="ghost"
                      size="sm"
                      disabled={deleteTemplateMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add supplement form */}
      {isAdding && (
        <Card className="border-2 border-dashed">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label htmlFor="supplement-name">Supplement Name</Label>
              <Input
                id="supplement-name"
                placeholder="e.g., Vitamin C Tablet"
                value={newSupplementName}
                onChange={(e) => setNewSupplementName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="supplement-dose">Dose</Label>
              <Input
                id="supplement-dose"
                placeholder="e.g., 1 tablet, 500mg"
                value={newSupplementDose}
                onChange={(e) => setNewSupplementDose(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddSupplement}
                disabled={createTemplateMutation.isPending}
                className="flex-1"
              >
                Add Supplement
              </Button>
              <Button
                onClick={() => {
                  setIsAdding(false);
                  setNewSupplementName("");
                  setNewSupplementDose("");
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add button (shown when not adding and less than 5 templates) */}
      {!isAdding && templates.length > 0 && templates.length < 5 && (
        <Button
          onClick={() => setIsAdding(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Supplement ({templates.length}/5)
        </Button>
      )}

      {templates.length >= 5 && !isAdding && (
        <p className="text-xs text-gray-500 text-center">
          Maximum 5 supplements reached. Delete one to add more.
        </p>
      )}
    </div>
  );
}
