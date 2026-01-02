import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

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
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fibre, setFibre] = useState("");

  const handleAdd = () => {
    if (!name.trim()) {
      return;
    }

    onAdd({
      name: name.trim(),
      calories: parseInt(calories) || 0,
      protein: parseInt(protein) || 0,
      fat: parseInt(fat) || 0,
      carbs: parseInt(carbs) || 0,
      fibre: parseInt(fibre) || 0,
    });

    // Reset form
    setName("");
    setCalories("");
    setProtein("");
    setFat("");
    setCarbs("");
    setFibre("");
    onOpenChange(false);
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
          <div>
            <Label htmlFor="component-name">Food Name *</Label>
            <Input
              id="component-name"
              placeholder="e.g., Soy milk, Olive oil, Honey"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="component-calories">Calories (kcal)</Label>
              <Input
                id="component-calories"
                type="number"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="component-protein">Protein (g)</Label>
              <Input
                id="component-protein"
                type="number"
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="component-fat">Fat (g)</Label>
              <Input
                id="component-fat"
                type="number"
                placeholder="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="component-carbs">Carbs (g)</Label>
              <Input
                id="component-carbs"
                type="number"
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="component-fibre">Fiber (g)</Label>
              <Input
                id="component-fibre"
                type="number"
                placeholder="0"
                value={fibre}
                onChange={(e) => setFibre(e.target.value)}
              />
            </div>
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
              disabled={!name.trim()}
              style={{backgroundColor: '#578DB3'}}
            >
              Add Component
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
