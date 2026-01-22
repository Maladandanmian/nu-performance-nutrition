import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ComponentEditor } from "@/components/ComponentEditor";
import { AddComponentForm } from "@/components/AddComponentForm";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { fromHongKongDateTimeLocal } from "@/lib/timezone";

interface MealEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: any | null;
  clientId: number;
  onSuccess: () => void;
}

export function MealEditDialog({ open, onOpenChange, meal, clientId, onSuccess }: MealEditDialogProps) {
  // State management
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const [mealDateTime, setMealDateTime] = useState("");
  const [mealNotes, setMealNotes] = useState("");
  const [identifiedItems, setIdentifiedItems] = useState<string[]>([]);
  const [editedComponents, setEditedComponents] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageKey, setImageKey] = useState("");
  const [drinkType, setDrinkType] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [beverageNutrition, setBeverageNutrition] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(true);
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAdvice, setShowAdvice] = useState(false);
  const [improvementAdvice, setImprovementAdvice] = useState("");

  const utils = trpc.useUtils();

  // Mutations
  const updateMealMutation = trpc.meals.update.useMutation({
    onSuccess: () => {
      toast.success("Meal updated successfully!");
      utils.meals.list.invalidate({ clientId });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to update meal: ${error.message}`);
    },
  });

  const analyzeMealWithDrinkMutation = trpc.meals.analyzeMealWithDrink.useMutation({
    onSuccess: (data) => {
      toast.success("Meal re-analyzed!");
      setEditedComponents(data.mealAnalysis.components || []);
      setAnalysisResult({
        description: data.mealAnalysis.description,
        calories: data.mealAnalysis.calories,
        protein: data.mealAnalysis.protein,
        fat: data.mealAnalysis.fat,
        carbs: data.mealAnalysis.carbs,
        fibre: data.mealAnalysis.fibre,
        confidence: (data.mealAnalysis as any).confidence,
        components: data.mealAnalysis.components,
        score: (data as any).finalScore, // Read from top-level finalScore
        referenceCardDetected: (data.mealAnalysis as any).referenceCardDetected,
        validationWarnings: (data.mealAnalysis as any).validationWarnings,
      });
    },
    onError: (error) => {
      toast.error(`Failed to analyze meal: ${error.message}`);
    },
  });

  const estimateBeverageMutation = trpc.meals.estimateBeverage.useMutation({
    onSuccess: (data) => {
      setBeverageNutrition({
        ...data.nutrition,
        drinkType,
        volumeMl: parseInt(volumeMl),
      });
      toast.success("Beverage nutrition estimated!");
    },
    onError: (error) => {
      toast.error(`Failed to estimate beverage: ${error.message}`);
    },
  });

  const recalculateScoreMutation = trpc.meals.recalculateScore.useMutation({
    onSuccess: (data) => {
      setAnalysisResult((prev: any) => ({ ...prev, score: data.score }));
      toast.success("Score recalculated!");
    },
    onError: (error) => {
      toast.error(`Failed to recalculate score: ${error.message}`);
    },
  });

  const getAdviceMutation = trpc.meals.getImprovementAdvice.useMutation({
    onSuccess: (data) => {
      setImprovementAdvice(data.advice);
      setShowAdvice(true);
    },
    onError: (error) => {
      toast.error(`Failed to get advice: ${error.message}`);
    },
  });

  // Initialize state when meal changes
  useEffect(() => {
    if (meal && open) {
      const mealComponents = meal.components || [];
      const itemDescriptions = mealComponents.map((c: any) => c.name);
      
      setIdentifiedItems(itemDescriptions);
      setEditedComponents(mealComponents);
      setMealType(meal.mealType);
      setMealNotes(meal.notes || "");
      setImageUrl(meal.imageUrl || "");
      setImageKey(meal.imageKey || "");
      
      // Set meal date/time
      if (meal.loggedAt) {
        const mealDate = new Date(meal.loggedAt);
        const hongKongTime = new Date(mealDate.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
        const year = hongKongTime.getFullYear();
        const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
        const day = String(hongKongTime.getDate()).padStart(2, '0');
        const hours = String(hongKongTime.getHours()).padStart(2, '0');
        const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
        setMealDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      }
      
      // Set beverage data
      if (meal.beverageType && meal.beverageVolumeMl) {
        setDrinkType(meal.beverageType);
        setVolumeMl(meal.beverageVolumeMl.toString());
        setBeverageNutrition({
          drinkType: meal.beverageType,
          volumeMl: meal.beverageVolumeMl,
          calories: meal.beverageCalories || 0,
          protein: meal.beverageProtein || 0,
          fat: meal.beverageFat || 0,
          carbs: meal.beverageCarbs || 0,
          fibre: meal.beverageFibre || 0,
        });
      } else {
        setDrinkType("");
        setVolumeMl("");
        setBeverageNutrition(null);
      }
      
      // Set analysis result
      setAnalysisResult({
        description: meal.aiDescription,
        calories: meal.calories,
        protein: meal.protein,
        fat: meal.fat,
        carbs: meal.carbs,
        fibre: meal.fibre,
        confidence: meal.aiConfidence,
        components: mealComponents,
        score: meal.nutritionScore,
      });
    }
  }, [meal, open]);

  // Calculate totals
  const calculatedTotals = useMemo(() => {
    const foodTotals = editedComponents.reduce(
      (acc, comp) => ({
        calories: acc.calories + (comp.calories || 0),
        protein: acc.protein + (comp.protein || 0),
        fat: acc.fat + (comp.fat || 0),
        carbs: acc.carbs + (comp.carbs || 0),
        fibre: acc.fibre + (comp.fibre || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
    );

    if (beverageNutrition) {
      return {
        calories: foodTotals.calories + beverageNutrition.calories,
        protein: foodTotals.protein + beverageNutrition.protein,
        fat: foodTotals.fat + beverageNutrition.fat,
        carbs: foodTotals.carbs + beverageNutrition.carbs,
        fibre: foodTotals.fibre + beverageNutrition.fibre,
      };
    }

    return foodTotals;
  }, [editedComponents, beverageNutrition]);

  const handleReanalyze = async () => {
    const filteredItems = identifiedItems.filter(item => item.trim() !== "");
    
    // Allow analysis if there are food items OR a beverage
    if (filteredItems.length === 0 && !drinkType) {
      toast.error("Please add at least one food item or beverage");
      return;
    }

    // Estimate beverage if provided
    let drinkNutrition = null;
    if (drinkType && volumeMl) {
      if (drinkType.toLowerCase().trim() === 'water') {
        drinkNutrition = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
      } else {
        try {
          const result = await estimateBeverageMutation.mutateAsync({
            drinkType,
            volumeMl: parseInt(volumeMl),
          });
          drinkNutrition = result.nutrition;
        } catch (error) {
          toast.error("Failed to estimate beverage nutrition");
          return;
        }
      }
      
      setBeverageNutrition({
        ...drinkNutrition,
        drinkType,
        volumeMl: parseInt(volumeMl),
      });
    }

    await analyzeMealWithDrinkMutation.mutateAsync({
      clientId,
      imageUrl,
      imageKey,
      mealType,
      itemDescriptions: filteredItems,
      notes: mealNotes || undefined,
      drinkType: drinkType || undefined,
      volumeMl: volumeMl ? parseInt(volumeMl) : undefined,
    });
  };

  const handleSave = async () => {
    if (!meal) return;

    const loggedAt = fromHongKongDateTimeLocal(mealDateTime);

    await updateMealMutation.mutateAsync({
      mealId: meal.id,
      clientId,
      imageUrl,
      imageKey,
      mealType,
      calories: calculatedTotals.calories,
      protein: calculatedTotals.protein,
      fat: calculatedTotals.fat,
      carbs: calculatedTotals.carbs,
      fibre: calculatedTotals.fibre,
      aiDescription: analysisResult?.description || meal.aiDescription,
      aiConfidence: analysisResult?.confidence,
      notes: mealNotes || undefined,
      loggedAt,
      beverageType: drinkType || undefined,
      beverageVolumeMl: volumeMl ? parseInt(volumeMl) : undefined,
      beverageCalories: beverageNutrition?.calories,
      beverageProtein: beverageNutrition?.protein,
      beverageFat: beverageNutrition?.fat,
      beverageCarbs: beverageNutrition?.carbs,
      beverageFibre: beverageNutrition?.fibre,
      beverageCategory: beverageNutrition?.category,
      components: editedComponents,
    });
  };

  if (!meal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Meal</DialogTitle>
          <DialogDescription>
            {analysisResult?.description || meal.aiDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
            <div>
              <Label htmlFor="meal-date">Date & Time</Label>
              <Input
                id="meal-date"
                type="datetime-local"
                value={mealDateTime}
                onChange={(e) => setMealDateTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="meal-type">Meal Type</Label>
              <Select value={mealType} onValueChange={(value) => setMealType(value as any)}>
                <SelectTrigger id="meal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Food Items */}
          <div>
            <Label>Detected Food Items</Label>
            <div className="space-y-2 mt-2">
              {identifiedItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => {
                      const newItems = [...identifiedItems];
                      newItems[index] = e.target.value;
                      setIdentifiedItems(newItems);
                    }}
                    placeholder="e.g., 2 fried eggs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIdentifiedItems(identifiedItems.filter((_, i) => i !== index));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => setIdentifiedItems([...identifiedItems, ""])}
            >
              + Add Item
            </Button>
          </div>

          {/* Beverage Section */}
          <div className="border-t pt-4">
            <Label>Accompanying Beverage (Optional)</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <Input
                  placeholder="e.g., Coffee with milk"
                  value={drinkType}
                  onChange={(e) => setDrinkType(e.target.value)}
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Volume (ml)"
                  value={volumeMl}
                  onChange={(e) => setVolumeMl(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={mealNotes}
              onChange={(e) => setMealNotes(e.target.value)}
            />
          </div>

          {/* Re-analyze Button */}
          <Button
            className="w-full"
            onClick={handleReanalyze}
            disabled={analyzeMealWithDrinkMutation.isPending}
            variant="outline"
          >
            {analyzeMealWithDrinkMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Re-analyzing...
              </>
            ) : (
              "🔄 Re-analyze"
            )}
          </Button>

          {/* Nutrition Score */}
          {analysisResult && (
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
              <div className="text-sm font-medium text-gray-600 mb-2">Nutrition Score</div>
              <div className="text-5xl font-bold" style={{color: '#578DB3'}}>
                {analysisResult.score || 1}/5
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-2xl">
                    {star <= (analysisResult.score || 0) ? '⭐' : '☆'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Food Components */}
          {editedComponents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg" style={{color: '#578DB3'}}>Food Components</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (isEditMode) {
                      await recalculateScoreMutation.mutateAsync({
                        clientId,
                        calories: calculatedTotals.calories,
                        protein: calculatedTotals.protein,
                        fat: calculatedTotals.fat,
                        carbs: calculatedTotals.carbs,
                        fibre: calculatedTotals.fibre,
                      });
                      setShowAdvice(false);
                      setImprovementAdvice("");
                    }
                    setIsEditMode(!isEditMode);
                  }}
                  className="text-xs"
                  disabled={recalculateScoreMutation.isPending}
                >
                  {recalculateScoreMutation.isPending ? "Updating..." : (isEditMode ? "Done Editing" : "Edit Components")}
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {editedComponents.map((component, index) => (
                  <ComponentEditor
                    key={index}
                    component={component}
                    index={index}
                    isEditMode={isEditMode}
                    imageUrl={imageUrl}
                    onUpdate={(updated) => {
                      const newComponents = [...editedComponents];
                      newComponents[index] = updated;
                      setEditedComponents(newComponents);
                    }}
                    onDelete={() => {
                      setEditedComponents(editedComponents.filter((_, i) => i !== index));
                    }}
                  />
                ))}
              </div>
              {isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddComponent(true)}
                  className="w-full"
                >
                  + Add Component
                </Button>
              )}
            </div>
          )}

          {/* Total Nutrition */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-lg" style={{color: '#578DB3'}}>Total Nutrition</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  Calories
                </span>
                <span className="text-lg font-bold">{calculatedTotals.calories} kcal</span>
              </div>
              <Progress value={Math.min(calculatedTotals.calories / 10, 100)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium flex items-center gap-2">
                  <span className="text-xl">💪</span>
                  Protein
                </span>
                <span className="text-lg font-bold">{calculatedTotals.protein}g</span>
              </div>
              <Progress value={Math.min(calculatedTotals.protein * 2, 100)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium flex items-center gap-2">
                  <span className="text-xl">🥑</span>
                  Fats
                </span>
                <span className="text-lg font-bold">{calculatedTotals.fat}g</span>
              </div>
              <Progress value={Math.min(calculatedTotals.fat * 2, 100)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium flex items-center gap-2">
                  <span className="text-xl">🍞</span>
                  Carbs
                </span>
                <span className="text-lg font-bold">{calculatedTotals.carbs}g</span>
              </div>
              <Progress value={Math.min(calculatedTotals.carbs * 1.5, 100)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium flex items-center gap-2">
                  <span className="text-xl">🌾</span>
                  Fiber
                </span>
                <span className="text-lg font-bold">{calculatedTotals.fibre}g</span>
              </div>
              <Progress value={Math.min(calculatedTotals.fibre * 4, 100)} className="h-2" />
            </div>
          </div>

          {/* AI Confidence */}
          {analysisResult?.confidence && (
            <div className="text-center text-sm text-gray-600 pt-4 border-t">
              AI Confidence: {analysisResult.confidence}%
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMealMutation.isPending}
              className="flex-1"
              style={{backgroundColor: '#578DB3'}}
            >
              {updateMealMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Add Component Dialog */}
        <Dialog open={showAddComponent} onOpenChange={setShowAddComponent}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Food Component</DialogTitle>
            </DialogHeader>
            <AddComponentForm
              open={showAddComponent}
              onOpenChange={setShowAddComponent}
              onAdd={(newComponent) => {
                setEditedComponents([...editedComponents, newComponent]);
                setShowAddComponent(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
