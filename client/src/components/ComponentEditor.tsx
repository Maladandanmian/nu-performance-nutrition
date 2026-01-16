import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Edit2, Check, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ComponentEditorProps {
  component: {
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
  };
  index: number;
  isEditMode: boolean;
  onUpdate: (updated: any) => void;
  onDelete: () => void;
  imageUrl?: string; // For AI re-estimation
}

export function ComponentEditor({ component, index, isEditMode, onUpdate, onDelete, imageUrl }: ComponentEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(component);
  const [originalName, setOriginalName] = useState(component.name);
  const reEstimateMutation = trpc.meals.reEstimateComponent.useMutation();

  const handleSave = () => {
    onUpdate(editedData);
    setIsEditing(false);
    setOriginalName(editedData.name);
  };

  const handleAIReEstimate = async () => {
    if (!imageUrl) {
      toast.error("Image not available for re-estimation");
      return;
    }

    try {
      toast.info("AI is re-analyzing this component...");
      const result = await reEstimateMutation.mutateAsync({
        componentName: editedData.name,
        imageUrl,
      });

      if (result.success && result.nutrition) {
        setEditedData({
          name: result.nutrition.name,
          calories: result.nutrition.calories,
          protein: result.nutrition.protein,
          fat: result.nutrition.fat,
          carbs: result.nutrition.carbs,
          fibre: result.nutrition.fibre,
        });
        toast.success("Nutrition values updated by AI");
      }
    } catch (error) {
      console.error("AI re-estimation error:", error);
      toast.error("Failed to re-estimate nutrition. Please enter values manually.");
    }
  };

  const handleCancel = () => {
    setEditedData(component);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-300">
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Food Name</label>
              {imageUrl && editedData.name !== originalName && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAIReEstimate}
                  disabled={reEstimateMutation.isPending}
                  className="h-6 text-xs"
                >
                  {reEstimateMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                      AI Re-analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1 text-blue-600" />
                      AI Re-estimate
                    </>
                  )}
                </Button>
              )}
            </div>
            <Input
              value={editedData.name}
              onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
              className="text-sm h-8"
            />
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-700">Calories</label>
              <Input
                type="number"
                value={editedData.calories}
                onChange={(e) => setEditedData({ ...editedData, calories: parseInt(e.target.value) || 0 })}
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Protein (g)</label>
              <Input
                type="number"
                value={editedData.protein}
                onChange={(e) => setEditedData({ ...editedData, protein: parseInt(e.target.value) || 0 })}
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Fat (g)</label>
              <Input
                type="number"
                value={editedData.fat}
                onChange={(e) => setEditedData({ ...editedData, fat: parseInt(e.target.value) || 0 })}
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Carbs (g)</label>
              <Input
                type="number"
                value={editedData.carbs}
                onChange={(e) => setEditedData({ ...editedData, carbs: parseInt(e.target.value) || 0 })}
                className="text-xs h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Fiber (g)</label>
              <Input
                type="number"
                value={editedData.fibre}
                onChange={(e) => setEditedData({ ...editedData, fibre: parseInt(e.target.value) || 0 })}
                className="text-xs h-8"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs"
              style={{backgroundColor: '#578DB3'}}
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${isEditMode ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium text-sm mb-1">{component.name}</div>
          <div className="grid grid-cols-5 gap-2 text-xs text-gray-600">
            <div><span className="font-semibold">{component.calories}</span> kcal</div>
            <div><span className="font-semibold">{component.protein}g</span> protein</div>
            <div><span className="font-semibold">{component.fat}g</span> fat</div>
            <div><span className="font-semibold">{component.carbs}g</span> carbs</div>
            <div><span className="font-semibold">{component.fibre}g</span> fiber</div>
          </div>
        </div>
        {isEditMode && (
          <div className="flex gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 w-7 p-0"
            >
              <Edit2 className="h-3 w-3 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-7 w-7 p-0"
            >
              <Trash2 className="h-3 w-3 text-red-600" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
