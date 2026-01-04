import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface AddComponentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (component: {
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
  }) => void;
}

export function AddComponentForm({ open, onOpenChange, onAdd }: AddComponentFormProps) {
  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("");
  const estimateFoodMutation = trpc.meals.estimateFood.useMutation();

  const handleAdd = async () => {
    if (!foodName.trim() || !quantity.trim()) {
      toast.error("Please enter both food name and quantity");
      return;
    }

    try {
      toast.info("AI is estimating nutrition...");
      const result = await estimateFoodMutation.mutateAsync({
        foodName: foodName.trim(),
        quantity: quantity.trim(),
      });

      if (result.success && result.nutrition) {
        onAdd({
          name: result.nutrition.name,
          calories: result.nutrition.calories,
          protein: result.nutrition.protein,
          fat: result.nutrition.fat,
          carbs: result.nutrition.carbs,
          fibre: result.nutrition.fibre,
        });

        // Reset form
        setFoodName("");
        setQuantity("");
        onOpenChange(false);
        toast.success("Food component added");
      }
    } catch (error) {
      console.error("AI estimation error:", error);
      toast.error("Failed to estimate nutrition. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Food Component</DialogTitle>
          <DialogDescription>
            Add a food item that the AI missed or that you want to include
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">AI-Powered Nutrition Estimation</span>
            </div>
            <p className="text-xs text-blue-700">
              Just enter the food name and quantity - AI will calculate the nutrition values automatically
            </p>
          </div>

          <div>
            <Label htmlFor="food-name">Food Name *</Label>
            <Input
              id="food-name"
              placeholder="e.g., fried eggs, banana, chicken breast"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              disabled={estimateFoodMutation.isPending}
            />
          </div>

          <div>
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              placeholder="e.g., 2, 1 medium, 100g, 1 cup"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={estimateFoodMutation.isPending}
            />
            <p className="text-xs text-gray-500 mt-1">
              Examples: "2" (2 items), "1 medium", "100g", "1 cup", "3 slices"
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!foodName.trim() || !quantity.trim() || estimateFoodMutation.isPending}
              style={{backgroundColor: '#578DB3'}}
            >
              {estimateFoodMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Estimating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add Component
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
