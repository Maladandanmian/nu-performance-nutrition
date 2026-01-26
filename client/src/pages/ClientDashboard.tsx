import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { NutritionHistoryFeed } from "@/components/NutritionHistoryFeed";
import { NutrientTrendGraphs } from "@/components/NutrientTrendGraphs";
import TodaysSummary from "@/components/TodaysSummary";
import { PhotoGuidelinesModal } from "@/components/PhotoGuidelinesModal";
import { ComponentEditor } from "@/components/ComponentEditor";
import { AddComponentForm } from "@/components/AddComponentForm";
import { FavoriteMealsButtons } from "@/components/FavoriteMealsButtons";
import { FavoriteDrinksButtons } from "@/components/FavoriteDrinksButtons";
import { Camera, Droplets, History, LogOut, RotateCcw, Scale, Upload, X, Star } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { fromHongKongDateTimeLocal } from "@/lib/timezone";
import { BodyweightTrendChart } from "@/components/BodyweightTrendChart";
import { DexaVisualizationPanels } from "@/components/DexaVisualizationPanels";

// Helper function to determine meal type based on current time
const getMealTypeFromTime = (): "breakfast" | "lunch" | "dinner" | "snack" => {
  const now = new Date();
  const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  const hour = hongKongTime.getHours();
  
  // Breakfast: 6am - 10am
  if (hour >= 6 && hour < 10) return 'breakfast';
  // Lunch: 12pm - 2pm
  if (hour >= 12 && hour < 14) return 'lunch';
  // Dinner: 6pm - 9pm
  if (hour >= 18 && hour < 21) return 'dinner';
  // Snack: all other times
  return 'snack';
};

export default function ClientDashboard() {
  // ALL HOOKS MUST BE CALLED AT THE TOP BEFORE ANY RETURNS
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { clientSession, loading: clientLoading, logout: clientLogout } = useClientAuth();
  const [, setLocation] = useLocation();
  
  // Fetch goals data for bodyweight trend
  const timezoneOffset = new Date().getTimezoneOffset();
  const { data: goalsData } = trpc.meals.dailyTotals.useQuery(
    { 
      clientId: clientSession?.clientId || 0, 
      days: 1,
      timezoneOffset
    },
    { enabled: !!clientSession?.clientId }
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">(() => getMealTypeFromTime());
  const [mealNotes, setMealNotes] = useState("");
  const [drinkType, setDrinkType] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [drinkDateTime, setDrinkDateTime] = useState(() => {
    const now = new Date();
    const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const year = hongKongTime.getFullYear();
    const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
    const day = String(hongKongTime.getDate()).padStart(2, '0');
    const hours = String(hongKongTime.getHours()).padStart(2, '0');
    const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [mealDateTime, setMealDateTime] = useState(() => {
    const now = new Date();
    const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const year = hongKongTime.getFullYear();
    const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
    const day = String(hongKongTime.getDate()).padStart(2, '0');
    const hours = String(hongKongTime.getHours()).padStart(2, '0');
    const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [justLoggedDrinkId, setJustLoggedDrinkId] = useState<number | null>(null);
  const [weight, setWeight] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showPhotoGuide, setShowPhotoGuide] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedComponents, setEditedComponents] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageKey, setImageKey] = useState<string>("");
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [improvementAdvice, setImprovementAdvice] = useState<string>("");
  const [showAdvice, setShowAdvice] = useState(false);
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [mealSource, setMealSource] = useState<"meal_photo" | "nutrition_label">("meal_photo");
  
  // NEW FLOW: State for item identification and editing
  const [identifiedItems, setIdentifiedItems] = useState<string[]>([]);
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [overallDescription, setOverallDescription] = useState("");
  const [beverageNutrition, setBeverageNutrition] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Input mode state (meal photo, nutrition label, or text description)
  const [inputMode, setInputMode] = useState<"meal" | "label" | "text">("meal");
  const [mealTextDescription, setMealTextDescription] = useState("");
  const [extractedNutrition, setExtractedNutrition] = useState<any>(null);
  const [showNutritionEditor, setShowNutritionEditor] = useState(false);
  const [portionPercentage, setPortionPercentage] = useState(100);

  // Calculate nutrition for nutrition label based on servings consumed
  const calculatedNutritionLabel = useMemo(() => {
    if (!extractedNutrition?.perServingNutrition) return null;
    
    const servings = extractedNutrition.servingsConsumed || 1;
    return {
      calories: Math.round(extractedNutrition.perServingNutrition.calories * servings),
      protein: Math.round(extractedNutrition.perServingNutrition.protein * servings * 10) / 10,
      fat: Math.round(extractedNutrition.perServingNutrition.fat * servings * 10) / 10,
      carbs: Math.round(extractedNutrition.perServingNutrition.carbs * servings * 10) / 10,
      fiber: Math.round(extractedNutrition.perServingNutrition.fiber * servings * 10) / 10,
    };
  }, [extractedNutrition?.perServingNutrition, extractedNutrition?.servingsConsumed]);

  // Calculate totals from edited components + beverage, applying portion percentage
  const calculatedTotals = useMemo(() => {
    let mealTotals;
    if (editedComponents.length === 0) {
      mealTotals = {
        calories: analysisResult?.calories || 0,
        protein: analysisResult?.protein || 0,
        fat: analysisResult?.fat || 0,
        carbs: analysisResult?.carbs || 0,
        fibre: analysisResult?.fibre || 0,
      };
    } else {
      // Sum up all components
      mealTotals = editedComponents.reduce(
        (acc, comp) => ({
          calories: acc.calories + (comp.calories || 0),
          protein: acc.protein + (comp.protein || 0),
          fat: acc.fat + (comp.fat || 0),
          carbs: acc.carbs + (comp.carbs || 0),
          fibre: acc.fibre + (comp.fibre || 0),
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
      );
    }

    // Add beverage nutrition if available
    if (beverageNutrition) {
      mealTotals = {
        calories: mealTotals.calories + (beverageNutrition.calories || 0),
        protein: mealTotals.protein + (beverageNutrition.protein || 0),
        fat: mealTotals.fat + (beverageNutrition.fat || 0),
        carbs: mealTotals.carbs + (beverageNutrition.carbs || 0),
        fibre: mealTotals.fibre + (beverageNutrition.fibre || 0),
      };
    }

    // Apply portion percentage scaling to all values
    const portionMultiplier = portionPercentage / 100;
    return {
      calories: Math.round(mealTotals.calories * portionMultiplier),
      protein: Math.round(mealTotals.protein * portionMultiplier * 10) / 10,
      fat: Math.round(mealTotals.fat * portionMultiplier * 10) / 10,
      carbs: Math.round(mealTotals.carbs * portionMultiplier * 10) / 10,
      fibre: Math.round(mealTotals.fibre * portionMultiplier * 10) / 10,
    };
  }, [editedComponents, analysisResult, beverageNutrition, portionPercentage]);

  // ALL TRPC HOOKS MUST BE CALLED UNCONDITIONALLY
  // NEW FLOW: Step 2 - Identify items in meal image
  const identifyItemsMutation = trpc.meals.identifyItems.useMutation({
    onSuccess: (data) => {
      setIdentifiedItems(data.items);
      setOverallDescription(data.overallDescription);
      setImageUrl(data.imageUrl);
      setImageKey(data.imageKey);
      
      // Refresh meal date/time to current time for new meal
      const now = new Date();
      const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
      const year = hongKongTime.getFullYear();
      const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
      const day = String(hongKongTime.getDate()).padStart(2, '0');
      const hours = String(hongKongTime.getHours()).padStart(2, '0');
      const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
      setMealDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      
      // Note: Meal type is NOT reset here - user's selection is preserved
      // Time-based default is only applied on initial component load (line 60)
      
      setShowItemEditor(true);
      // Reset file input only (keep beverage data from upload screen)
      setSelectedFile(null);
      setPortionPercentage(100); // Reset portion to 100% for new meal
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Note: beverage fields (drinkType, volumeMl) are preserved from upload screen
    },
    onError: (error) => {
      toast.error(`Failed to identify meal items: ${error.message}`);
    },
  });

  // NEW FLOW: Analyze meal from text description
  const analyzeTextMealMutation = trpc.meals.analyzeTextMeal.useMutation({
    onSuccess: (data) => {
      setIdentifiedItems(data.items);
      setOverallDescription(data.overallDescription);
      setImageUrl(""); // No image for text-based entry
      setImageKey(""); // No image for text-based entry
      
      // Refresh meal date/time to current time for new meal
      const now = new Date();
      const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
      const year = hongKongTime.getFullYear();
      const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
      const day = String(hongKongTime.getDate()).padStart(2, '0');
      const hours = String(hongKongTime.getHours()).padStart(2, '0');
      const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
      setMealDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      
      setShowItemEditor(true);
      // Clear text input after successful analysis
      setMealTextDescription("");
      setPortionPercentage(100); // Reset portion to 100% for new meal
    },
    onError: (error) => {
      toast.error(`Failed to analyze meal description: ${error.message}`);
    },
  });

  // Nutrition label extraction mutation
  const extractNutritionLabelMutation = trpc.meals.extractNutritionLabel.useMutation({
    onSuccess: (data) => {
      // Store extracted nutrition data with default values
      setExtractedNutrition({
        ...data,
        servingsConsumed: 1, // Default to 1 actual serving
        amountConsumed: data.actualServingSize, // Default to 1 actual serving size
      });
      setImageUrl(data.imageUrl);
      setImageKey(data.imageKey);
      
      // Refresh meal date/time to current time
      const now = new Date();
      const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
      const year = hongKongTime.getFullYear();
      const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
      const day = String(hongKongTime.getDate()).padStart(2, '0');
      const hours = String(hongKongTime.getHours()).padStart(2, '0');
      const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
      setMealDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      
      // Note: Meal type is NOT reset here - user's selection is preserved
      // Time-based default is only applied on initial component load (line 60)
      
      // Show nutrition editor instead of item editor
      setShowNutritionEditor(true);
      // Reset file input
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => {
      toast.error(`Failed to extract nutrition label: ${error.message}`);
    },
  });

  // Analyze nutrition label meal mutation
  const analyzeNutritionLabelMealMutation = trpc.meals.analyzeNutritionLabelMeal.useMutation({
    onSuccess: (data) => {
      setShowNutritionEditor(false);
      setMealSource("nutrition_label"); // Mark this as a nutrition label meal
      setAnalysisResult({
        ...data.mealAnalysis,
        score: data.finalScore,
      });
      
      // Set beverage nutrition if present
      if (data.drinkNutrition) {
        setBeverageNutrition({
          drinkType: drinkType,
          volumeMl: parseFloat(volumeMl),
          ...data.drinkNutrition,
        });
      } else {
        setBeverageNutrition(null);
      }
      
      setShowAnalysisModal(true);
      // Reset form
      setExtractedNutrition(null);
      setDrinkType("");
      setVolumeMl("");
      setMealNotes("");
      // Reset input mode to meal
      setInputMode("meal");
    },
    onError: (error) => {
      toast.error(`Failed to analyze nutrition label meal: ${error.message}`);
    },
  });

  // NEW FLOW: Step 4-6 - Analyze meal with drink and save
  const analyzeMealWithDrinkMutation = trpc.meals.analyzeMealWithDrink.useMutation({
    onSuccess: (data) => {
      console.log('[analyzeMealWithDrink] Full Response:', JSON.stringify(data, null, 2));
      console.log('[analyzeMealWithDrink] Meal Analysis:', data.mealAnalysis);
      console.log('[analyzeMealWithDrink] Calories:', data.mealAnalysis?.calories);
      console.log('[analyzeMealWithDrink] Protein:', data.mealAnalysis?.protein);
      console.log('[analyzeMealWithDrink] Components:', data.mealAnalysis?.components);
      setShowItemEditor(false);
      setAnalysisResult({
        ...data.mealAnalysis,
        score: data.finalScore,
        combinedNutrition: data.combinedNutrition,
        drinkNutrition: data.drinkNutrition,
      });
      // Update editedComponents with the new components from AI analysis
      // This ensures calculatedTotals reflects the updated nutrition values
      setEditedComponents(data.mealAnalysis.components || []);
      setShowAnalysisModal(true);
      // Reset form fields (but keep imageUrl/imageKey and mealType for saving later)
      setIdentifiedItems([]);
      setOverallDescription("");
      // DO NOT reset mealType here - preserve user selection
      setMealNotes("");
      // Note: drinkType, volumeMl, and beverageNutrition are NOT cleared here - they're needed for saveMeal
      // Note: imageUrl and imageKey are NOT cleared here - they're needed for saveMeal
      // Note: No success toast here - meal is not saved yet, only analyzed
    },
    onError: (error) => {
      toast.error(`Failed to analyze meal: ${error.message}`);
    },
  });

  const utils = trpc.useUtils();
  
  const deleteMealMutation = trpc.meals.delete.useMutation({
    onSuccess: () => {
      toast.success("Meal deleted successfully!");
      utils.meals.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete meal: ${error.message}`);
    },
  });

  const updateMealMutation = trpc.meals.update.useMutation({
    onSuccess: () => {
      toast.success("Meal updated successfully!");
      setShowAnalysisModal(false);
      setIsEditMode(false);
      setShowAdvice(false);
      setImprovementAdvice("");
      setEditingMealId(null);
      utils.meals.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update meal: ${error.message}`);
    },
  });
  
  const recalculateScoreMutation = trpc.meals.recalculateScore.useMutation({
    onSuccess: (data) => {
      if (data.success && analysisResult) {
        setAnalysisResult({
          ...analysisResult,
          score: data.score,
        });
        toast.success('Meal score updated');
      }
    },
  });

  const saveMealMutation = trpc.meals.saveMeal.useMutation({
    onSuccess: (data, variables) => {
      toast.success('Meal logged successfully!');
      setShowAnalysisModal(false);
      setIsEditMode(false);
      setShowAdvice(false);
      setImprovementAdvice("");
      // Clear image and beverage data after successful save
      setImageUrl("");
      setImageKey("");
      setDrinkType("");
      setVolumeMl("");
      setMealSource("meal_photo"); // Reset to default
      setBeverageNutrition(null);
      setPortionPercentage(100); // Reset portion to 100%
      
      // Explicitly update the cache with the new meal to prevent it from disappearing
      utils.meals.list.setData(
        { clientId: variables.clientId },
        (oldData) => {
          if (!oldData) return oldData;
          // Create a new meal object with the returned ID
          const newMeal = {
            id: data.mealId,
            clientId: variables.clientId,
            imageUrl: variables.imageUrl || "",
            imageKey: variables.imageKey || "",
            mealType: variables.mealType,
            calories: variables.calories,
            protein: variables.protein,
            fat: variables.fat,
            carbs: variables.carbs,
            fibre: variables.fibre,
            aiDescription: variables.aiDescription,
            aiConfidence: variables.aiConfidence,
            nutritionScore: data.score,
            notes: variables.notes || "",
            beverageType: variables.beverageType || null,
            beverageVolumeMl: variables.beverageVolumeMl || null,
            beverageCalories: variables.beverageCalories || null,
            beverageProtein: variables.beverageProtein || null,
            beverageFat: variables.beverageFat || null,
            beverageCarbs: variables.beverageCarbs || null,
            beverageFibre: variables.beverageFibre || null,
            beverageCategory: variables.beverageCategory || null,
            components: variables.components || null,
            loggedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            source: variables.source || "meal_photo",
          } as any; // Type assertion to match the expected type
          // Add new meal to the beginning of the array
          return [newMeal, ...oldData];
        }
      );
      
      // Also invalidate to ensure consistency with server
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to save meal: ${error.message}`);
    },
  });

  const getAdviceMutation = trpc.meals.getImprovementAdvice.useMutation({
    onSuccess: (data) => {
      setImprovementAdvice(data.advice);
      setShowAdvice(true);
    },
    onError: (error) => {
      toast.error(`Failed to generate advice: ${error.message}`);
    },
  });

  const estimateBeverageMutation = trpc.meals.estimateBeverage.useMutation({
    onSuccess: (data) => {
      setBeverageNutrition(data.nutrition);
      // Silent success - no toast to keep flow consistent with meal logging
    },
    onError: (error) => {
      toast.error(`Failed to estimate beverage: ${error.message}`);
    },
  });

  const logDrinkMutation = trpc.drinks.create.useMutation({
    onSuccess: (data) => {
      toast.success("Drink logged successfully!");
      // Store the drink ID for potential editing in summary modal
      if (data && data.drinkId) {
        setJustLoggedDrinkId(data.drinkId);
      }
      // Don't clear form yet - user might want to edit in summary modal
      // Refetch today's summary to update hydration
      // Show summary instead of reloading
    },
    onError: (error) => {
      toast.error(`Failed to log drink: ${error.message}`);
    },
  });

  const deleteDrinkMutation = trpc.drinks.delete.useMutation({
    onSuccess: () => {
      toast.success("Drink deleted successfully!");
      utils.drinks.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete drink: ${error.message}`);
    },
  });

  const updateDrinkMutation = trpc.drinks.update.useMutation({
    onSuccess: () => {
      toast.success("Drink updated successfully!");
      setShowAnalysisModal(false);
      setDrinkType("");
      setVolumeMl("");
      setBeverageNutrition(null);
      setEditingMealId(null);
      utils.drinks.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update drink: ${error.message}`);
    },
  });

  const repeatLastDrinkMutation = trpc.drinks.repeatLast.useMutation({
    onSuccess: () => {
      toast.success("Last drink repeated successfully!");
      utils.drinks.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to repeat last drink");
    },
  });

  const logMetricsMutation = trpc.bodyMetrics.create.useMutation({
    onSuccess: () => {
      toast.success("Metrics logged successfully!");
      setWeight("");
      // Invalidate bodyMetrics query to refetch data in the graph
      utils.bodyMetrics.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to log metrics: ${error.message}`);
    },
  });

  // Redirect non-authenticated users (both OAuth and PIN)
  useEffect(() => {
    if (!loading && !clientLoading && !isAuthenticated && !clientSession) {
      setLocation('/');
    }
  }, [loading, clientLoading, isAuthenticated, clientSession, setLocation]);

  // Redirect trainers to trainer dashboard
  useEffect(() => {
    if (user?.role === 'admin') {
      setLocation('/trainer');
    }
  }, [user, setLocation]);

  // NOW WE CAN SAFELY DO EARLY RETURNS AFTER ALL HOOKS ARE CALLED
  
  // Show loading while checking auth
  if (loading || clientLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Return null if not authenticated (will redirect via useEffect)
  if (!isAuthenticated && !clientSession) {
    return null;
  }

  // Use client session if available, otherwise use OAuth user
  const displayName = clientSession?.name || user?.name || "Client";
  const currentClientId = clientSession?.clientId || 1; // Default to 1 for demo
  const handleLogoutClick = clientSession ? clientLogout : logout;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleLogMeal = async () => {
    // Auto-estimate beverage if fields filled but not estimated yet
    let nutritionToUse = beverageNutrition;
    if (drinkType && volumeMl && !beverageNutrition) {
      // Special handling for plain water - no API call needed
      if (drinkType.toLowerCase().trim() === 'water') {
        const waterNutrition = {
          drinkType: 'Water',
          volumeMl: parseInt(volumeMl),
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          fibre: 0,
          confidence: 100,
          description: 'Plain water has no calories or nutrients'
        };
        setBeverageNutrition(waterNutrition);
        nutritionToUse = waterNutrition;
      } else {
        try {
          const result = await estimateBeverageMutation.mutateAsync({
            drinkType,
            volumeMl: parseInt(volumeMl),
          });
          setBeverageNutrition(result.nutrition);
          nutritionToUse = result.nutrition; // Use the nutrition object from the result
        } catch (error) {
          toast.error("Failed to estimate beverage nutrition");
          return;
        }
      }
    }

    // Drink-only logging
    if (!selectedFile && (nutritionToUse || (drinkType && volumeMl))) {
      if (!drinkType || !volumeMl) {
        toast.error("Please fill in drink type and volume");
        return;
      }
      
      if (!nutritionToUse) {
        toast.error("Please estimate beverage nutrition first");
        return;
      }
      
      // For beverage-only, create a drink entry (not a meal entry)
      try {
        await logDrinkMutation.mutateAsync({
          clientId: currentClientId,
          drinkType,
          volumeMl: parseInt(volumeMl),
          calories: nutritionToUse.calories,
          protein: nutritionToUse.protein,
          fat: nutritionToUse.fat,
          carbs: nutritionToUse.carbs,
          fibre: nutritionToUse.fibre,
          notes: "",
        });
        
        // Store drink details before clearing
        const currentDrinkType = drinkType;
        const currentVolumeMl = volumeMl;
        
        // Clear form
        setDrinkType("");
        setVolumeMl("");
        setBeverageNutrition(null);
        // Show summary modal with drink nutrition
        // Score drinks 1-5: low-cal drinks score higher (5 is best)
        const drinkScore = nutritionToUse.calories < 50 ? 5 : nutritionToUse.calories < 100 ? 4 : nutritionToUse.calories < 150 ? 3 : nutritionToUse.calories < 200 ? 2 : 1;
        setAnalysisResult({
          description: currentDrinkType,
          calories: nutritionToUse.calories,
          protein: nutritionToUse.protein,
          fat: nutritionToUse.fat,
          carbs: nutritionToUse.carbs,
          fibre: nutritionToUse.fibre,
          score: drinkScore,
          isDrink: true,
          drinkType: currentDrinkType,
          volumeMl: currentVolumeMl,
        });
        // Set the modal state variables with the drink details
        setDrinkType(currentDrinkType);
        setVolumeMl(currentVolumeMl);
        setShowAnalysisModal(true);
      } catch (error) {
        console.error('Error logging beverage:', error);
        toast.error("Failed to log beverage");
      }
      return;
    }

    // NEW FLOW: Meal logging - Step 1: Upload and identify items
    if (!selectedFile) {
      toast.error("Please select an image");
      return;
    }

    const clientId = currentClientId;

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix

        // Step 2: Check mode and call appropriate procedure
        if (inputMode === "label") {
          // Nutrition label mode: extract nutrition data
          await extractNutritionLabelMutation.mutateAsync({
            clientId,
            imageBase64: base64Data,
          });
        } else {
          // Meal photo mode: identify items
          await identifyItemsMutation.mutateAsync({
            clientId,
            imageBase64: base64Data,
          });
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Error uploading meal:', error);
    }
  };

  const handleLogDrink = async () => {
    if (!drinkType || !volumeMl) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!beverageNutrition) {
      toast.error("Please estimate beverage nutrition first");
      return;
    }

    const clientId = clientSession?.clientId;
    if (!clientId) {
      toast.error("Client session not found");
      return;
    }

    await logDrinkMutation.mutateAsync({
      clientId,
      drinkType,
      volumeMl: parseInt(volumeMl),
      calories: beverageNutrition.calories,
      protein: beverageNutrition.protein,
      fat: beverageNutrition.fat,
      carbs: beverageNutrition.carbs,
      fibre: beverageNutrition.fibre,
    });
  };

  const handleLogMetrics = async () => {
    if (!weight) {
      toast.error("Please enter weight");
      return;
    }

    const clientId = clientSession?.clientId;
    if (!clientId) {
      toast.error("Client session not found");
      return;
    }

    await logMetricsMutation.mutateAsync({
      clientId,
      weight: weight ? parseFloat(weight) : undefined,
    });
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const handleDeleteMeal = async (mealId: number) => {
    if (confirm("Are you sure you want to delete this meal? This action cannot be undone.")) {
      await deleteMealMutation.mutateAsync({ mealId });
    }
  };

  const handleEditMeal = (meal: any) => {
    // Populate the analysis modal with the meal data including components
    const mealComponents = meal.components || [];
    
    // Convert components to identifiedItems format (array of strings)
    const itemDescriptions = mealComponents.map((c: any) => c.name);
    setIdentifiedItems(itemDescriptions);
    
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
    setEditedComponents(mealComponents);
    setImageUrl(meal.imageUrl || "");
    setImageKey(meal.imageKey || "");
    
    // Load beverage data if present
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
    
    setIsEditMode(true);
    setShowItemEditor(true); // Show item editor instead of analysis modal
    setEditingMealId(meal.id);
    setMealType(meal.mealType);
    setPortionPercentage(100); // Reset portion to 100% when editing meal
    
    // Set meal date/time from loggedAt
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
    
    // Set beverage data if present
    if (meal.beverageType) {
      setDrinkType(meal.beverageType);
      setVolumeMl(meal.beverageVolumeMl?.toString() || "");
      // Set beverage nutrition from meal data
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
      // Clear beverage fields if no beverage
      setDrinkType("");
      setVolumeMl("");
      setBeverageNutrition(null);
    }
  };

  const handleEditDrink = (drink: any) => {
    // Set drink data for editing
    setDrinkType(drink.drinkType);
    setVolumeMl(drink.volumeMl.toString());
    setBeverageNutrition({
      drinkType: drink.drinkType,
      volumeMl: drink.volumeMl,
      calories: drink.calories,
      protein: drink.protein,
      fat: drink.fat,
      carbs: drink.carbs,
      fibre: drink.fibre,
    });
    
    // Clear food items (drinks don't have food components)
    setIdentifiedItems([]);
    setEditedComponents([]);
    
    // Set description for the modal
    setOverallDescription(`Editing beverage: ${drink.drinkType}`);
    
    // Set drink date/time from loggedAt
    if (drink.loggedAt) {
      const drinkDate = new Date(drink.loggedAt);
      const hongKongTime = new Date(drinkDate.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
      const year = hongKongTime.getFullYear();
      const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
      const day = String(hongKongTime.getDate()).padStart(2, '0');
      const hours = String(hongKongTime.getHours()).padStart(2, '0');
      const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
      setMealDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
    
    // Set meal type to snack for drinks (required field)
    setMealType('snack');
    
    // Mark as editing drink (negative ID)
    setEditingMealId(-drink.id);
    setIsEditMode(true);
    
    // Open item editor modal (unified interface)
    setShowItemEditor(true);
  };

  const handleDeleteDrink = async (drinkId: number) => {
    if (confirm("Are you sure you want to delete this drink? This action cannot be undone.")) {
      await deleteDrinkMutation.mutateAsync({ drinkId });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/nu-logo.png" alt="Nu Performance" className="h-12 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{color: '#6F6E70'}}>{displayName}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogoutClick}
              style={{borderColor: '#578DB3', color: '#578DB3'}}
              className="hover:bg-blue-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Today's Summary Widget */}
          <TodaysSummary clientId={clientSession?.clientId || 0} />
          
          <Tabs defaultValue="log-meal">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="log-meal">Log Meal</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="log-metrics">Metrics</TabsTrigger>
            <TabsTrigger value="dexa">DEXA Scans</TabsTrigger>
          </TabsList>

          {/* Log Meal Tab */}
          <TabsContent value="log-meal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Log Your Meal
                </CardTitle>
                <CardDescription>
                  Take a photo or select from gallery for AI analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode Toggle */}
                <div className="flex items-center justify-center gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("meal");
                      setExtractedNutrition(null);
                      setShowNutritionEditor(false);
                    }}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      inputMode === "meal"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    📸 Meal Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("label");
                      setIdentifiedItems([]);
                      setShowItemEditor(false);
                    }}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      inputMode === "label"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    🏷️ Nutrition Label
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("text");
                      setIdentifiedItems([]);
                      setShowItemEditor(false);
                    }}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      inputMode === "text"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    ✍️ Text Description
                  </button>
                </div>

                {/* Photo input for meal photo and nutrition label modes */}
                {inputMode !== "text" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="meal-image">{inputMode === "meal" ? "Meal Photo" : "Nutrition Label Photo"}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPhotoGuide(true)}
                        className="text-xs"
                      >
                        <Camera className="h-3 w-3 mr-1" />
                        Photo Tips
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <Input
                        id="meal-image"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="flex-1"
                        ref={fileInputRef}
                      />
                      {selectedFile && (
                        <span className="text-sm text-gray-600">{selectedFile.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Include a credit card, business card, or Octopus card for accurate portion sizing
                    </p>
                  </div>
                )}

                {/* Text input for text description mode */}
                {inputMode === "text" && (
                  <div>
                    <Label htmlFor="meal-description">Meal Description</Label>
                    <Textarea
                      id="meal-description"
                      placeholder="Describe your meal from memory (e.g., 'hamachi poke bowl with sesame sauce' or 'french toast with maple syrup')"
                      value={mealTextDescription}
                      onChange={(e) => setMealTextDescription(e.target.value)}
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Be as specific as possible for better nutrition estimates
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="meal-type">Meal Type</Label>
                  <Select value={mealType} onValueChange={(value: any) => setMealType(value)}>
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

                {/* Quick Log Meals */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <Label className="text-sm font-semibold">Quick Log Meals</Label>
                  </div>
                  <FavoriteMealsButtons clientId={clientSession?.clientId || 0} />
                </div>

                <div>
                  <Label htmlFor="meal-notes">Notes (optional)</Label>
                  <Textarea
                    id="meal-notes"
                    placeholder="Any additional notes about this meal..."
                    value={mealNotes}
                    onChange={(e) => setMealNotes(e.target.value)}
                  />
                </div>

                {/* Beverage Section */}
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <Label className="text-base font-semibold">Add Beverage</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    💡 Log a drink, a meal, or both together
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="drink-type">Drink Type</Label>
                      <Input
                        id="drink-type"
                        placeholder="e.g., Cappuccino, Soda"
                        value={drinkType}
                        onChange={(e) => setDrinkType(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="volume">Volume (ml)</Label>
                      <Input
                        id="volume"
                        type="number"
                        placeholder="e.g., 250"
                        value={volumeMl}
                        onChange={(e) => setVolumeMl(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* Volume Reference Guide */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-2">Quick Reference:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <div>• Glass = 250ml</div>
                      <div>• Mug = 250ml</div>
                      <div>• Water Bottle = 500ml</div>
                      <div>• Can = 330ml</div>
                      <div>• Wine Glass = 150ml</div>
                      <div>• Shot = 30ml</div>
                    </div>
                  </div>

                  {/* Quick Log Drinks */}
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <Label className="text-sm font-semibold">Quick Log Drinks</Label>
                    </div>
                    <FavoriteDrinksButtons clientId={clientSession?.clientId || 0} />
                  </div>
                </div>

                {/* Conditional buttons based on what's filled */}
                {/* Text mode: Analyze text description */}
                {inputMode === "text" && mealTextDescription && !drinkType && !volumeMl && (
                  <Button 
                    onClick={() => {
                      if (!clientSession?.clientId) {
                        toast.error("Client session not found");
                        return;
                      }
                      analyzeTextMealMutation.mutate({
                        clientId: clientSession.clientId,
                        mealDescription: mealTextDescription,
                      });
                    }}
                    className="w-full"
                    disabled={analyzeTextMealMutation.isPending}
                  >
                    {analyzeTextMealMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analyzing Description...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Analyze Meal
                      </>
                    )}
                  </Button>
                )}

                {inputMode === "text" && mealTextDescription && drinkType && volumeMl && (
                  <Button 
                    onClick={() => {
                      if (!clientSession?.clientId) {
                        toast.error("Client session not found");
                        return;
                      }
                      analyzeTextMealMutation.mutate({
                        clientId: clientSession.clientId,
                        mealDescription: mealTextDescription,
                      });
                    }}
                    className="w-full"
                    disabled={analyzeTextMealMutation.isPending}
                  >
                    {analyzeTextMealMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analyzing Description...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Analyze Meal + Beverage
                      </>
                    )}
                  </Button>
                )}

                {/* Photo modes: Analyze photo */}
                {inputMode !== "text" && selectedFile && !drinkType && !volumeMl && (
                  <Button 
                    onClick={handleLogMeal} 
                    className="w-full"
                    disabled={identifyItemsMutation.isPending}
                  >
                    {identifyItemsMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Identifying Items...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Analyze Meal
                      </>
                    )}
                  </Button>
                )}
                
                {inputMode !== "text" && selectedFile && drinkType && volumeMl && (
                  <Button 
                    onClick={handleLogMeal} 
                    className="w-full"
                    disabled={identifyItemsMutation.isPending}
                  >
                    {identifyItemsMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Identifying Items...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Analyze Meal + Beverage
                      </>
                    )}
                  </Button>
                )}
                
                {!selectedFile && drinkType && volumeMl && (
                  <Button 
                    onClick={async () => {
                      try {
                        // Estimate beverage nutrition
                        const result = await estimateBeverageMutation.mutateAsync({
                          drinkType,
                          volumeMl: parseInt(volumeMl),
                        });
                        
                        // Save drink directly
                        await logDrinkMutation.mutateAsync({
                          clientId: clientSession?.clientId || 0,
                          drinkType,
                          volumeMl: parseInt(volumeMl),
                          calories: result.nutrition.calories,
                          protein: result.nutrition.protein,
                          fat: result.nutrition.fat,
                          carbs: result.nutrition.carbs,
                          fibre: result.nutrition.fibre,
                          notes: '',
                        });
                        
                        // Clear form
                        setDrinkType('');
                        setVolumeMl('');
                        setBeverageNutrition(null);
                      } catch (error) {
                        console.error('Error logging beverage:', error);
                        toast.error('Failed to log beverage');
                      }
                    }}
                    className="w-full"
                    disabled={estimateBeverageMutation.isPending || logDrinkMutation.isPending}
                  >
                    {estimateBeverageMutation.isPending || logDrinkMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Logging...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Log Beverage
                      </>
                    )}
                  </Button>
                )}
                
                {!selectedFile && !drinkType && !volumeMl && (
                  <Button 
                    className="w-full"
                    disabled
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add Photo or Beverage
                  </Button>
                )}

                {/* Favorite Meals & Repeat Last Meal */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <Label className="text-base font-semibold">Quick Log</Label>
                  </div>
                  <FavoriteMealsButtons clientId={clientSession?.clientId || 0} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nutrition History Tab (Meals + Drinks) */}
          <TabsContent value="nutrition">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Nutrition History
                </CardTitle>
                <CardDescription>
                  View and edit all your logged meals and drinks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NutritionHistoryFeed 
                  clientId={clientSession?.clientId || 0} 
                  onEditMeal={handleEditMeal}
                  onDeleteMeal={handleDeleteMeal}
                  onEditDrink={handleEditDrink}
                  onDeleteDrink={handleDeleteDrink}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">📈</span>
                  Nutrition Trends
                </CardTitle>
                <CardDescription>
                  Track your daily nutrient consumption vs targets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NutrientTrendGraphs clientId={clientSession?.clientId || 0} days={14} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Log Metrics Tab */}
          <TabsContent value="log-metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Body Metrics
                </CardTitle>
                <CardDescription>
                  Track your weight over time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 75.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>

                <Button onClick={handleLogMetrics} className="w-full">
                  Log Metrics
                </Button>
              </CardContent>
            </Card>

            {/* Bodyweight Trend Chart */}
            {clientSession?.clientId && goalsData?.goals && (
              <BodyweightTrendChart 
                clientId={clientSession.clientId} 
                goals={goalsData.goals}
              />
            )}
          </TabsContent>

          {/* DEXA Scans Tab */}
          <TabsContent value="dexa">
            <Card>
              <CardHeader>
                <CardTitle>Your DEXA Scan Results</CardTitle>
                <CardDescription>
                  Track your body composition, visceral fat, and bone density progress over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DexaVisualizationPanels clientId={clientSession?.clientId || 0} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </main>

      {/* Nutrition Label Editor Modal */}
      <Dialog open={showNutritionEditor} onOpenChange={setShowNutritionEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Nutrition Label Data</DialogTitle>
            <DialogDescription>
              Extracted nutrition information from the label. Edit if needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date and Time Section */}
            <div className="grid grid-cols-2 gap-4 border-b pb-4">
              <div>
                <Label htmlFor="label-meal-date">Date</Label>
                <Input
                  id="label-meal-date"
                  type="datetime-local"
                  value={mealDateTime}
                  onChange={(e) => setMealDateTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="label-meal-type">Meal Type</Label>
                <Select value={mealType} onValueChange={(value) => setMealType(value as "breakfast" | "lunch" | "dinner" | "snack")}>
                  <SelectTrigger id="label-meal-type">
                    <SelectValue placeholder="Select meal type" />
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

            {/* Extracted Nutrition Data */}
            {extractedNutrition && (
              <div className="space-y-4">
                {/* Product Name */}
                <div>
                  <Label>Product Name</Label>
                  <Input
                    value={extractedNutrition.productName}
                    onChange={(e) => setExtractedNutrition({...extractedNutrition, productName: e.target.value})}
                    placeholder="Product name"
                  />
                </div>

                {/* Reference Serving Info */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <Label className="text-sm font-semibold text-blue-900">Label Reference (Nutrition per...)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="number"
                      value={extractedNutrition.referenceSize}
                      onChange={(e) => setExtractedNutrition({...extractedNutrition, referenceSize: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <Input
                      value={extractedNutrition.referenceUnit}
                      onChange={(e) => setExtractedNutrition({...extractedNutrition, referenceUnit: e.target.value})}
                      placeholder="g/ml"
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500 self-center">(e.g., "per 100g")</span>
                  </div>
                </div>

                {/* Actual Serving Size */}
                <div className="bg-green-50 p-3 rounded-lg">
                  <Label className="text-sm font-semibold text-green-900">Actual Serving Size</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="number"
                      value={extractedNutrition.actualServingSize}
                      onChange={(e) => setExtractedNutrition({...extractedNutrition, actualServingSize: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <Input
                      value={extractedNutrition.actualServingUnit}
                      onChange={(e) => setExtractedNutrition({...extractedNutrition, actualServingUnit: e.target.value})}
                      placeholder="g/ml"
                      className="w-20"
                    />
                    <Input
                      value={extractedNutrition.actualServingDescription}
                      onChange={(e) => setExtractedNutrition({...extractedNutrition, actualServingDescription: e.target.value})}
                      placeholder="per sachet/scoop"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">e.g., 3.5g per sachet, 35g per scoop</p>
                </div>

                {/* Servings Consumed */}
                <div>
                  <Label>How many servings did you consume?</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={extractedNutrition.servingsConsumed === 0 ? '' : (extractedNutrition.servingsConsumed ?? 1)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setExtractedNutrition({...extractedNutrition, servingsConsumed: 0});
                        return;
                      }
                      const servings = parseFloat(val);
                      if (!isNaN(servings)) {
                        setExtractedNutrition({...extractedNutrition, servingsConsumed: servings});
                      }
                    }}
                    placeholder="1"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {extractedNutrition.servingsConsumed > 0 && (
                      `= ${(extractedNutrition.servingsConsumed * extractedNutrition.actualServingSize).toFixed(1)}${extractedNutrition.actualServingUnit} total`
                    )}
                  </p>
                </div>

                {/* Nutrition Values (reactive to servings consumed) */}
                <div className="border-t pt-3">
                  <Label className="text-sm font-semibold">
                    Total Nutrition (for {extractedNutrition.servingsConsumed || 1} serving{(extractedNutrition.servingsConsumed || 1) > 1 ? 's' : ''})
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">
                    = {((extractedNutrition.servingsConsumed || 1) * extractedNutrition.actualServingSize).toFixed(1)}{extractedNutrition.actualServingUnit} total
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <Label>Calories</Label>
                      <Input
                        type="number"
                        value={calculatedNutritionLabel?.calories || 0}
                        onChange={(e) => {
                          const newCalories = parseFloat(e.target.value);
                          const perServing = Math.round(newCalories / (extractedNutrition.servingsConsumed || 1));
                          setExtractedNutrition({
                            ...extractedNutrition,
                            perServingNutrition: {
                              ...extractedNutrition.perServingNutrition,
                              calories: perServing
                            }
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>Protein (g)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={calculatedNutritionLabel?.protein || 0}
                        onChange={(e) => {
                          const newProtein = parseFloat(e.target.value);
                          const perServing = Math.round((newProtein / (extractedNutrition.servingsConsumed || 1)) * 10) / 10;
                          setExtractedNutrition({
                            ...extractedNutrition,
                            perServingNutrition: {
                              ...extractedNutrition.perServingNutrition,
                              protein: perServing
                            }
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>Carbs (g)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={calculatedNutritionLabel?.carbs || 0}
                        onChange={(e) => {
                          const newCarbs = parseFloat(e.target.value);
                          const perServing = Math.round((newCarbs / (extractedNutrition.servingsConsumed || 1)) * 10) / 10;
                          setExtractedNutrition({
                            ...extractedNutrition,
                            perServingNutrition: {
                              ...extractedNutrition.perServingNutrition,
                              carbs: perServing
                            }
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label>Fat (g)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={calculatedNutritionLabel?.fat || 0}
                        onChange={(e) => {
                          const newFat = parseFloat(e.target.value);
                          const perServing = Math.round((newFat / (extractedNutrition.servingsConsumed || 1)) * 10) / 10;
                          setExtractedNutrition({
                            ...extractedNutrition,
                            perServingNutrition: {
                              ...extractedNutrition.perServingNutrition,
                              fat: perServing
                            }
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>Fiber (g)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={calculatedNutritionLabel?.fiber || 0}
                        onChange={(e) => {
                          const newFiber = parseFloat(e.target.value);
                          const perServing = Math.round((newFiber / (extractedNutrition.servingsConsumed || 1)) * 10) / 10;
                          setExtractedNutrition({
                            ...extractedNutrition,
                            perServingNutrition: {
                              ...extractedNutrition.perServingNutrition,
                              fiber: perServing
                            }
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Beverage Section */}
            <div className="border-t pt-3">
              <Label>
                {drinkType || volumeMl ? "Accompanying Beverage" : "Add Beverage (Optional)"}
              </Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="label-drink-type">Drink Type</Label>
                  <Input
                    id="label-drink-type"
                    placeholder="e.g., Water"
                    value={drinkType}
                    onChange={(e) => setDrinkType(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="label-volume">Volume (ml)</Label>
                  <Input
                    id="label-volume"
                    type="number"
                    placeholder="500"
                    value={volumeMl}
                    onChange={(e) => setVolumeMl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Meal Notes */}
            <div>
              <Label htmlFor="label-meal-notes">Notes (Optional)</Label>
              <Textarea
                id="label-meal-notes"
                placeholder="Any additional notes..."
                value={mealNotes}
                onChange={(e) => setMealNotes(e.target.value)}
              />
            </div>

            {/* Analyze Button */}
            <Button
              className="w-full"
              onClick={async () => {
                if (!extractedNutrition?.servingsConsumed || extractedNutrition.servingsConsumed <= 0) {
                  toast.error("Please enter number of servings consumed");
                  return;
                }
                
                if (!clientSession?.clientId) {
                  toast.error("Client session not found");
                  return;
                }
                
                // Use the calculated nutrition values (already scaled by servings)
                const finalNutrition = calculatedNutritionLabel || {
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  fiber: 0,
                };
                
                // Create serving description
                const servings = extractedNutrition.servingsConsumed;
                const totalGrams = (servings * extractedNutrition.actualServingSize).toFixed(1);
                const servingDescription = `${servings} ${extractedNutrition.actualServingDescription}${servings > 1 ? 's' : ''} (${totalGrams}${extractedNutrition.actualServingUnit} total)`;
                
                analyzeNutritionLabelMealMutation.mutate({
                  clientId: clientSession.clientId,
                  imageUrl,
                  imageKey,
                  mealType,
                  productName: extractedNutrition.productName,
                  servingDescription,
                  ingredients: extractedNutrition.ingredients || [],
                  calories: finalNutrition.calories,
                  protein: finalNutrition.protein,
                  carbs: finalNutrition.carbs,
                  fat: finalNutrition.fat,
                  fiber: finalNutrition.fiber,
                  notes: mealNotes,
                  drinkType: drinkType || undefined,
                  volumeMl: volumeMl ? parseFloat(volumeMl) : undefined,
                });
              }}
              disabled={analyzeNutritionLabelMealMutation.isPending}
            >
              {analyzeNutritionLabelMealMutation.isPending ? "Analyzing..." : "Analyze Meal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NEW FLOW: Item Editor Modal (Step 3) */}
      <Dialog open={showItemEditor} onOpenChange={setShowItemEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review and Edit Meal Items</DialogTitle>
            <DialogDescription>
              {overallDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Meal Type Section */}
            <div className="border-b pb-3">
              <Label htmlFor="edit-meal-type">Meal Type</Label>
              <Select value={mealType} onValueChange={(value) => setMealType(value as "breakfast" | "lunch" | "dinner" | "snack")}>
                <SelectTrigger id="edit-meal-type">
                  <SelectValue placeholder="Select meal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Meal Items List - Only show if editing a meal (not drink-only) */}
            {(identifiedItems.length > 0 || editingMealId === null || (editingMealId && editingMealId > 0)) && (
              <div>
                <Label>Detected Food Items (Approx.)</Label>
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
                          const newItems = identifiedItems.filter((_, i) => i !== index);
                          setIdentifiedItems(newItems);
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
            )}

            {/* Beverage Section */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label>
                  {drinkType || volumeMl ? "Accompanying Beverage" : "Add Beverage (Optional)"}
                </Label>
                {(drinkType || volumeMl) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDrinkType("");
                      setVolumeMl("");
                      setBeverageNutrition(null);
                      toast.success("Beverage removed");
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove Drink
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="drink-type">Drink Type</Label>
                  <Input
                    id="drink-type"
                    placeholder="e.g., water"
                    value={drinkType}
                    onChange={(e) => setDrinkType(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="volume">Volume (ml)</Label>
                  <Input
                    id="volume"
                    type="number"
                    placeholder="250"
                    value={volumeMl}
                    onChange={(e) => setVolumeMl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Portion Section */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="portion-percentage">Portion Consumed</Label>
                <span className="text-sm text-gray-500">{portionPercentage}%</span>
              </div>
              <div className="space-y-2">
                <Input
                  id="portion-percentage"
                  type="number"
                  min="1"
                  max="100"
                  value={portionPercentage}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 100;
                    setPortionPercentage(Math.min(100, Math.max(1, value)));
                  }}
                  className="text-center font-semibold"
                />
                <p className="text-xs text-gray-500">
                  💡 Adjust if you only ate part of the meal (e.g., 50% for half a pizza)
                </p>
              </div>
            </div>

            {/* Date and Time Section - Collapsed by default */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <Label>Date & Time</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const input = document.getElementById('edit-meal-date') as HTMLInputElement;
                    if (input) {
                      input.readOnly = false;
                      try {
                        input.showPicker?.();
                      } catch (e) {
                        // Ignore SecurityError in iframe context - native picker will still work
                      }
                    }
                  }}
                  className="text-xs"
                >
                  Edit
                </Button>
              </div>
              <Input
                id="edit-meal-date"
                type="datetime-local"
                value={mealDateTime}
                onChange={(e) => setMealDateTime(e.target.value)}
                readOnly
                className="mt-2 cursor-pointer"
                onClick={(e) => {
                  const input = e.target as HTMLInputElement;
                  input.readOnly = false;
                  try {
                    input.showPicker?.();
                  } catch (e) {
                    // Ignore SecurityError in iframe context - native picker will still work
                  }
                }}
              />
            </div>

            {/* Meal Notes */}
            <div>
              <Label htmlFor="meal-notes">Notes (Optional)</Label>
              <Textarea
                id="meal-notes"
                placeholder="Any additional notes..."
                value={mealNotes}
                onChange={(e) => setMealNotes(e.target.value)}
              />
            </div>

            {/* Analyse Meal Button - Only show if there are food items */}
            {identifiedItems.length > 0 && (
              <Button
                className="w-full"
                onClick={async () => {
                  // Filter out empty items
                  const filteredItems = identifiedItems.filter(item => item.trim() !== "");
                  
                  if (filteredItems.length === 0) {
                    toast.error("Please add at least one food item");
                    return;
                  }

                // Estimate beverage nutrition if provided
                let drinkNutrition = null;
                if (drinkType && volumeMl) {
                  if (drinkType.toLowerCase().trim() === 'water') {
                    // Water has no nutrition
                    drinkNutrition = {
                      calories: 0,
                      protein: 0,
                      fat: 0,
                      carbs: 0,
                      fibre: 0,
                    };
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
                  
                  // Set beverage nutrition state so it's included when saving the meal
                  setBeverageNutrition({
                    ...drinkNutrition,
                    drinkType,
                    volumeMl: parseInt(volumeMl),
                  });
                }

                // Call analyzeMealWithDrink
                await analyzeMealWithDrinkMutation.mutateAsync({
                  clientId: currentClientId,
                  imageUrl,
                  imageKey,
                  mealType,
                  itemDescriptions: filteredItems,
                  notes: mealNotes || undefined,
                  drinkType: drinkType || undefined,
                  volumeMl: volumeMl ? parseInt(volumeMl) : undefined,
                });
              }}
              disabled={analyzeMealWithDrinkMutation.isPending}
            >
              {analyzeMealWithDrinkMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing Meal...
                </>
              ) : (
                "Analyse Meal"
              )}
            </Button>
            )}

            {/* Save Changes Button - Only show when editing existing meal */}
            {editingMealId && editingMealId > 0 && (
              <Button
                className="w-full"
                onClick={async () => {
                  try {
                    // Re-analyze the meal with updated data
                    const filteredItems = identifiedItems.filter(item => item.trim() !== "");
                    
                    if (filteredItems.length === 0) {
                      toast.error("Please add at least one food item");
                      return;
                    }

                    // Estimate beverage nutrition if provided
                    let drinkNutrition = null;
                    if (drinkType && volumeMl) {
                      if (drinkType.toLowerCase().trim() === 'water') {
                        drinkNutrition = {
                          calories: 0,
                          protein: 0,
                          fat: 0,
                          carbs: 0,
                          fibre: 0,
                        };
                      } else {
                        const result = await estimateBeverageMutation.mutateAsync({
                          drinkType,
                          volumeMl: parseInt(volumeMl),
                        });
                        drinkNutrition = result.nutrition;
                      }
                    }

                    // Re-analyze meal with updated items and beverage
                    const analysisResult = await analyzeMealWithDrinkMutation.mutateAsync({
                      clientId: currentClientId,
                      imageUrl,
                      imageKey,
                      mealType,
                      itemDescriptions: filteredItems,
                      notes: mealNotes || undefined,
                      drinkType: drinkType || undefined,
                      volumeMl: volumeMl ? parseInt(volumeMl) : undefined,
                    });

                    // Extract meal analysis from response
                    const mealAnalysis = analysisResult.mealAnalysis;
                    const combinedNutrition = analysisResult.combinedNutrition;

                    // Update the meal with new analysis results and edited fields
                    await updateMealMutation.mutateAsync({
                      mealId: editingMealId,
                      clientId: currentClientId,
                      imageUrl,
                      imageKey,
                      mealType,
                      calories: combinedNutrition.calories,
                      protein: combinedNutrition.protein,
                      fat: combinedNutrition.fat,
                      carbs: combinedNutrition.carbs,
                      fibre: combinedNutrition.fibre,
                      aiDescription: mealAnalysis.description,
                      aiConfidence: 0.8,
                      notes: mealNotes || undefined,
                      loggedAt: new Date(mealDateTime),
                      beverageType: drinkType || undefined,
                      beverageVolumeMl: volumeMl ? parseInt(volumeMl) : undefined,
                      beverageCalories: drinkNutrition?.calories,
                      beverageProtein: drinkNutrition?.protein,
                      beverageFat: drinkNutrition?.fat,
                      beverageCarbs: drinkNutrition?.carbs,
                      beverageFibre: drinkNutrition?.fibre,
                      components: mealAnalysis.components,
                    });

                    toast.success("Meal updated successfully");
                    setShowItemEditor(false);
                    setEditingMealId(null);
                    
                    // Refresh meal list
                    utils.meals.invalidate();
                  } catch (error) {
                    toast.error("Failed to update meal");
                    console.error(error);
                  }
                }}
                disabled={analyzeMealWithDrinkMutation.isPending || updateMealMutation.isPending}
              >
                {(analyzeMealWithDrinkMutation.isPending || updateMealMutation.isPending) ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving Changes...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            )}

            {/* Analyse Button for drink-only edits */}
            {identifiedItems.length === 0 && editingMealId && editingMealId < 0 && (
              <Button
                className="w-full"
                onClick={async () => {
                  if (!drinkType || !volumeMl) {
                    toast.error("Please provide drink type and volume");
                    return;
                  }
                  
                  // Estimate beverage nutrition
                  let drinkNutrition = null;
                  if (drinkType.toLowerCase().trim() === 'water') {
                    drinkNutrition = {
                      calories: 0,
                      protein: 0,
                      fat: 0,
                      carbs: 0,
                      fibre: 0,
                    };
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
                  
                  // Set beverage nutrition for display
                  setBeverageNutrition({
                    ...drinkNutrition,
                    drinkType,
                    volumeMl: parseInt(volumeMl),
                  });
                  
                  // Calculate drink score (1-5: low-cal drinks score higher)
                  const drinkScore = drinkNutrition.calories < 50 ? 5 : 
                                    drinkNutrition.calories < 100 ? 4 : 
                                    drinkNutrition.calories < 150 ? 3 : 
                                    drinkNutrition.calories < 200 ? 2 : 1;
                  
                  // Set analysis result for the modal
                  setAnalysisResult({
                    description: drinkType,
                    calories: drinkNutrition.calories,
                    protein: drinkNutrition.protein,
                    fat: drinkNutrition.fat,
                    carbs: drinkNutrition.carbs,
                    fibre: drinkNutrition.fibre,
                    score: drinkScore,
                    isDrink: true,
                  });
                  
                  // Close item editor and open analysis modal
                  setShowItemEditor(false);
                  setShowAnalysisModal(true);
                }}
                disabled={estimateBeverageMutation.isPending}
              >
                {estimateBeverageMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Analyzing...
                  </>
                ) : (
                  "Analyse Beverage"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Nutrition Analysis Modal */}
      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="text-3xl">🎉</span>
              {analysisResult?.isDrink ? 'Beverage Logged!' : 'Meal Analysis Complete!'}
            </DialogTitle>
            {/* Only show description for meal entries, not beverage-only */}
            {!analysisResult?.isDrink && (
              <DialogDescription>
                {analysisResult?.description}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Reference Card Detection Indicator - only for meal entries */}
          {analysisResult && !analysisResult.isDrink && (
            <div className="flex items-center gap-2 px-1 py-2 text-sm text-gray-700">
              <input 
                type="checkbox" 
                checked={analysisResult.referenceCardDetected} 
                readOnly 
                className="h-4 w-4 rounded border-gray-300"
                style={{ accentColor: '#10b981' }}
              />
              <span>Card Detected for Portion Estimation</span>
            </div>
          )}

          <div className="space-y-4 mt-2">
            {/* Drink Details Section - show for drink-only */}
            {analysisResult?.isDrink && (
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-sm" style={{color: '#578DB3'}}>Drink Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="drink-type-display" className="text-xs">Drink Type</Label>
                    <Input
                      id="drink-type-display"
                      value={drinkType}
                      onChange={(e) => setDrinkType(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="volume-display" className="text-xs">Volume (ml)</Label>
                    <Input
                      id="volume-display"
                      type="number"
                      value={volumeMl}
                      onChange={(e) => setVolumeMl(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="drink-date" className="text-xs">Date</Label>
                    <Input
                      id="drink-date"
                      type="date"
                      value={drinkDateTime.split('T')[0]}
                      onChange={(e) => {
                        const time = drinkDateTime.split('T')[1] || '00:00';
                        setDrinkDateTime(`${e.target.value}T${time}`);
                      }}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="drink-time" className="text-xs">Time</Label>
                    <Input
                      id="drink-time"
                      type="time"
                      value={drinkDateTime.split('T')[1] || '00:00'}
                      onChange={(e) => {
                        const date = drinkDateTime.split('T')[0];
                        setDrinkDateTime(`${date}T${e.target.value}`);
                      }}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Meal Type Selector with Date/Time - hide for drink-only */}
            {!analysisResult?.isDrink && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="edit-meal-type" className="text-xs">Meal Type</Label>
                  <Select value={mealType} onValueChange={(value) => setMealType(value as "breakfast" | "lunch" | "dinner" | "snack")}>
                    <SelectTrigger id="edit-meal-type" className="h-9 text-sm">
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
                <div>
                  <Label htmlFor="meal-date" className="text-xs">Date</Label>
                  <Input
                    id="meal-date"
                    type="date"
                    value={mealDateTime.split('T')[0]}
                    onChange={(e) => {
                      const time = mealDateTime.split('T')[1] || '00:00';
                      setMealDateTime(`${e.target.value}T${time}`);
                    }}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="meal-time" className="text-xs">Time</Label>
                  <Input
                    id="meal-time"
                    type="time"
                    value={mealDateTime.split('T')[1] || '00:00'}
                    onChange={(e) => {
                      const date = mealDateTime.split('T')[0];
                      setMealDateTime(`${date}T${e.target.value}`);
                    }}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}



            {/* Nutrition Score */}
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
              <div className="text-sm font-medium text-gray-600 mb-2">Nutrition Score</div>
              <div className="text-5xl font-bold" style={{color: '#578DB3'}}>
                {analysisResult?.score}/5
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-2xl">
                    {star <= (analysisResult?.score || 0) ? '⭐' : '☆'}
                  </span>
                ))}
              </div>
            </div>



            <Button 
              onClick={() => {
                // If this is a drink-only summary (just logged), save any edits
                if (analysisResult?.isDrink && !editingMealId && justLoggedDrinkId) {
                  // Update the just-logged drink with any changes
                  updateDrinkMutation.mutate({
                    drinkId: justLoggedDrinkId,
                    drinkType,
                    volumeMl: parseInt(volumeMl),
                    loggedAt: fromHongKongDateTimeLocal(drinkDateTime),
                  });
                  setJustLoggedDrinkId(null);
                  return;
                }
                
                // If drink-only summary with no edits, just close
                if (analysisResult?.isDrink && !editingMealId) {
                  setShowAnalysisModal(false);
                  setJustLoggedDrinkId(null);
                  return;
                }
                
                // Check if editing a drink (negative ID)
                if (editingMealId && editingMealId < 0) {
                  // Update existing drink with nutrition values from analysis
                  updateDrinkMutation.mutate({
                    drinkId: -editingMealId,
                    drinkType,
                    volumeMl: parseInt(volumeMl),
                    loggedAt: fromHongKongDateTimeLocal(mealDateTime),
                    // Include nutrition values from AI re-analysis
                    calories: analysisResult?.calories || 0,
                    protein: analysisResult?.protein || 0,
                    fat: analysisResult?.fat || 0,
                    carbs: analysisResult?.carbs || 0,
                    fibre: analysisResult?.fibre || 0,
                  });
                } else if (isEditMode && editingMealId) {
                  // Update existing meal
                  updateMealMutation.mutate({
                    mealId: editingMealId,
                    clientId: currentClientId,
                    imageUrl,
                    imageKey,
                    mealType,
                    calories: calculatedTotals.calories,
                    protein: calculatedTotals.protein,
                    fat: calculatedTotals.fat,
                    carbs: calculatedTotals.carbs,
                    fibre: calculatedTotals.fibre,
                    aiDescription: analysisResult?.description || '',
                    aiConfidence: analysisResult?.confidence || 0,
                    loggedAt: fromHongKongDateTimeLocal(mealDateTime),
                    beverageType: beverageNutrition?.drinkType,
                    beverageVolumeMl: beverageNutrition?.volumeMl,
                    beverageCalories: beverageNutrition?.calories,
                    beverageProtein: beverageNutrition?.protein,
                    beverageFat: beverageNutrition?.fat,
                    beverageCarbs: beverageNutrition?.carbs,
                    beverageFibre: beverageNutrition?.fibre,
                    beverageCategory: beverageNutrition?.category,
                    components: analysisResult?.components,
                  });
                } else {
                  // Create new meal
                  console.log('[Log Meal] analysisResult:', analysisResult);
                  console.log('[Log Meal] components:', analysisResult?.components);
                  saveMealMutation.mutate({
                    clientId: currentClientId,
                    imageUrl,
                    imageKey,
                    mealType,
                    calories: calculatedTotals.calories,
                    protein: calculatedTotals.protein,
                    fat: calculatedTotals.fat,
                    carbs: calculatedTotals.carbs,
                    fibre: calculatedTotals.fibre,
                    aiDescription: analysisResult?.description || '',
                    aiConfidence: analysisResult?.confidence || 0,
                    beverageType: beverageNutrition?.drinkType,
                    beverageVolumeMl: beverageNutrition?.volumeMl,
                    beverageCalories: beverageNutrition?.calories,
                    beverageProtein: beverageNutrition?.protein,
                    beverageFat: beverageNutrition?.fat,
                    beverageCarbs: beverageNutrition?.carbs,
                    beverageFibre: beverageNutrition?.fibre,
                    beverageCategory: beverageNutrition?.category,
                    components: analysisResult?.components,
                    source: mealSource, // Pass the meal source (meal_photo or nutrition_label)
                  });
                }
                setEditingMealId(null);
              }} 
              className="w-full"
              style={{backgroundColor: '#578DB3'}}
              disabled={saveMealMutation.isPending || updateMealMutation.isPending || updateDrinkMutation.isPending}
            >
              {(saveMealMutation.isPending || updateMealMutation.isPending || updateDrinkMutation.isPending) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                analysisResult?.isDrink && !editingMealId && justLoggedDrinkId ? 'Save Changes' : analysisResult?.isDrink && !editingMealId ? 'Done' : (editingMealId && editingMealId < 0) ? 'Update Drink' : (isEditMode ? 'Update Meal' : 'Log Meal')
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Guidelines Modal */}
      <PhotoGuidelinesModal 
        open={showPhotoGuide} 
        onOpenChange={setShowPhotoGuide} 
      />

      {/* Add Component Form */}
      <AddComponentForm
        open={showAddComponent}
        onOpenChange={setShowAddComponent}
        onAdd={(newComponent) => {
          setEditedComponents([...editedComponents, newComponent]);
          setShowAddComponent(false);
        }}
      />
    </div>
  );
}
